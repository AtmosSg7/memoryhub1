#!/bin/sh
set -eu

if [ ! -f /etc/nginx/certs/fullchain.pem ] || [ ! -f /etc/nginx/certs/privkey.pem ]; then
  echo "[nginx] TLS certificates not found in /etc/nginx/certs."
  echo "[nginx] HTTPS (443) will fail until fullchain.pem and privkey.pem are provided."
  echo "[nginx] Use deploy/scripts/generate-self-signed-certs.sh for staging,"
  echo "[nginx] or mount Let's Encrypt certificates for production."
fi

exec "$@"
