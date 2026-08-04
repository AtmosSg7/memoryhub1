#!/usr/bin/env bash
# Restore uploads from a tarball created by backup-uploads.sh.
# Usage: ./restore-uploads.sh deploy/backups/uploads-YYYYMMDD-HHMMSS.tar.gz
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <path-to-uploads-archive.tar.gz>"
  exit 1
fi

ARCHIVE="$1"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=compose-production.sh
source "${ROOT_DIR}/deploy/scripts/compose-production.sh"

if [[ ! -f "${ARCHIVE}" ]]; then
  echo "Archive not found: ${ARCHIVE}"
  exit 1
fi

echo "WARNING: This will overwrite /app/uploads in the backend container."
read -r -p "Type RESTORE to continue: " confirm
if [[ "${confirm}" != "RESTORE" ]]; then
  echo "Aborted."
  exit 1
fi

cat "${ARCHIVE}" | compose_prod exec -T backend \
  tar -xzf - -C /app/uploads

echo "Uploads restore completed."
