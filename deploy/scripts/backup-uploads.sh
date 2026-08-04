#!/usr/bin/env bash
# Backup uploaded files from the persistent volume via the backend container.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=compose-production.sh
source "${ROOT_DIR}/deploy/scripts/compose-production.sh"
BACKUP_DIR="${ROOT_DIR}/deploy/backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="${BACKUP_DIR}/uploads-${TIMESTAMP}.tar.gz"

mkdir -p "${BACKUP_DIR}"

echo "Creating uploads backup..."

compose_prod exec -T backend \
  tar -czf - -C /app/uploads . > "${ARCHIVE}"

if [[ ! -s "${ARCHIVE}" ]]; then
  echo "WARN: uploads archive is empty (no files yet)."
fi

echo "Uploads backup saved to ${ARCHIVE}"

# Keep 7 daily uploads backups.
ls -1t "${BACKUP_DIR}"/uploads-*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm -f

echo "Done."
