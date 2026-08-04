#!/usr/bin/env bash
# Restore MongoDB from a mongodump archive (.archive.gz).
# Usage: ./restore-mongodb.sh deploy/backups/mongo-YYYYMMDD-HHMMSS.archive.gz
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <path-to-mongo-archive.gz>"
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

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

DB_NAME="${DB_NAME:-basera}"

echo "WARNING: This will overwrite database '${DB_NAME}'."
read -r -p "Type RESTORE to continue: " confirm
if [[ "${confirm}" != "RESTORE" ]]; then
  echo "Aborted."
  exit 1
fi

AUTH_ARGS=()
if [[ -n "${MONGO_ROOT_USERNAME:-}" && -n "${MONGO_ROOT_PASSWORD:-}" ]]; then
  AUTH_ARGS=(-u "${MONGO_ROOT_USERNAME}" -p "${MONGO_ROOT_PASSWORD}" --authenticationDatabase admin)
fi

echo "Restoring ${ARCHIVE} into ${DB_NAME}..."

gunzip -c "${ARCHIVE}" | compose_prod exec -T mongo \
  mongorestore "${AUTH_ARGS[@]}" --archive --drop --db="${DB_NAME}"

echo "Restore completed. Run deploy/scripts/check-database.sh to verify."
