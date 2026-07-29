#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CERT_DIR="${ROOT_DIR}/deploy/certs"
DOMAIN="${1:-localhost}"
DAYS="${2:-365}"

mkdir -p "${CERT_DIR}"

if [[ -f "${CERT_DIR}/fullchain.pem" && -f "${CERT_DIR}/privkey.pem" ]]; then
  echo "Certificates already exist in ${CERT_DIR}. Skipping."
  exit 0
fi

openssl req -x509 -nodes -newkey rsa:4096 \
  -keyout "${CERT_DIR}/privkey.pem" \
  -out "${CERT_DIR}/fullchain.pem" \
  -days "${DAYS}" \
  -subj "/CN=${DOMAIN}/O=MemoryHub/C=FR"

chmod 600 "${CERT_DIR}/privkey.pem"
chmod 644 "${CERT_DIR}/fullchain.pem"

echo "Self-signed certificates created in ${CERT_DIR}"
echo "For production, replace them with Let's Encrypt certificates."
