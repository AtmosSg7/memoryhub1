#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=compose-production.sh
source "${ROOT_DIR}/deploy/scripts/compose-production.sh"
BACKUP_DIR="${ROOT_DIR}/deploy/backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="${BACKUP_DIR}/mongo-${TIMESTAMP}.archive.gz"

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

DB_NAME="${DB_NAME:-basera}"
mkdir -p "${BACKUP_DIR}"

echo "Creating MongoDB backup for database: ${DB_NAME}"

AUTH_ARGS=()
if [[ -n "${MONGO_ROOT_USERNAME:-}" && -n "${MONGO_ROOT_PASSWORD:-}" ]]; then
  AUTH_ARGS=(-u "${MONGO_ROOT_USERNAME}" -p "${MONGO_ROOT_PASSWORD}" --authenticationDatabase admin)
fi

compose_prod exec -T mongo \
  mongodump "${AUTH_ARGS[@]}" --archive --gzip --db="${DB_NAME}" > "${ARCHIVE}"

echo "Backup saved to ${ARCHIVE}"

# Keep the 7 most recent daily backups.
ls -1t "${BACKUP_DIR}"/mongo-*.archive.gz 2>/dev/null | tail -n +8 | xargs -r rm -f

echo "Done."
