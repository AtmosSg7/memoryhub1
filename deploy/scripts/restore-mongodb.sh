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
COMPOSE_FILE="${ROOT_DIR}/docker-compose.yml"
ENV_FILE="${ROOT_DIR}/deploy/.env"

if [[ ! -f "${ARCHIVE}" ]]; then
  echo "Archive not found: ${ARCHIVE}"
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

DB_NAME="${DB_NAME:-memoryhub}"

echo "WARNING: This will overwrite database '${DB_NAME}'."
read -r -p "Type RESTORE to continue: " confirm
if [[ "${confirm}" != "RESTORE" ]]; then
  echo "Aborted."
  exit 1
fi

echo "Restoring ${ARCHIVE} into ${DB_NAME}..."

gunzip -c "${ARCHIVE}" | docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T mongo \
  mongorestore --archive --drop --db="${DB_NAME}"

echo "Restore completed. Run deploy/scripts/check-database.sh to verify."
