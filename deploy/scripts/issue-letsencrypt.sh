#!/usr/bin/env bash
# Issue or renew Let's Encrypt certificates into deploy/certs/.
# Run on the OVH VPS AFTER DNS for the domain points to this server.
#
# Do NOT run this until you are ready to connect basera.fr.
#
# Usage:
#   sudo ./deploy/scripts/issue-letsencrypt.sh basera.fr [www.basera.fr]
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo $0 <domain> [extra-domain…]"
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: sudo $0 basera.fr [www.basera.fr]"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CERT_DIR="${ROOT_DIR}/deploy/certs"
PRIMARY_DOMAIN="$1"
shift
EXTRA_DOMAINS=("$@")

CERTBOT_ARGS=(-d "${PRIMARY_DOMAIN}")
for d in "${EXTRA_DOMAINS[@]+"${EXTRA_DOMAINS[@]}"}"; do
  CERTBOT_ARGS+=(-d "${d}")
done

echo "=== Let's Encrypt for ${PRIMARY_DOMAIN} ==="
echo "This briefly stops nginx (ports 80/443 must be free for standalone)."

# shellcheck source=compose-production.sh
source "${ROOT_DIR}/deploy/scripts/compose-production.sh"

if command -v compose_prod >/dev/null 2>&1; then
  compose_prod stop nginx || true
fi

apt-get update -y
apt-get install -y certbot

certbot certonly --standalone --non-interactive --agree-tos \
  --register-unsafely-without-email \
  "${CERTBOT_ARGS[@]}"

LIVE_DIR="/etc/letsencrypt/live/${PRIMARY_DOMAIN}"
if [[ ! -f "${LIVE_DIR}/fullchain.pem" || ! -f "${LIVE_DIR}/privkey.pem" ]]; then
  echo "Certbot finished but files not found in ${LIVE_DIR}"
  exit 1
fi

mkdir -p "${CERT_DIR}"
cp "${LIVE_DIR}/fullchain.pem" "${CERT_DIR}/fullchain.pem"
cp "${LIVE_DIR}/privkey.pem" "${CERT_DIR}/privkey.pem"
chmod 644 "${CERT_DIR}/fullchain.pem"
chmod 600 "${CERT_DIR}/privkey.pem"
chown "${SUDO_USER:-root}:${SUDO_USER:-root}" "${CERT_DIR}/fullchain.pem" "${CERT_DIR}/privkey.pem"

compose_prod up -d nginx

echo "Certificates installed in ${CERT_DIR}"
echo "Verify: curl -fsS https://${PRIMARY_DOMAIN}/health"
