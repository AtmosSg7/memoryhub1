#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.yml"
ENV_FILE="${ROOT_DIR}/deploy/.env"
BACKUP_DIR="${ROOT_DIR}/deploy/backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="${BACKUP_DIR}/mongo-${TIMESTAMP}.archive.gz"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Copy deploy/.env.production.example first."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

DB_NAME="${DB_NAME:-memoryhub}"
mkdir -p "${BACKUP_DIR}"

echo "Creating MongoDB backup for database: ${DB_NAME}"

docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T mongo \
  mongodump --archive --gzip --db="${DB_NAME}" > "${ARCHIVE}"

echo "Backup saved to ${ARCHIVE}"

# Keep the 7 most recent daily backups; weekly archives kept 4 weeks.
ls -1t "${BACKUP_DIR}"/mongo-*.archive.gz 2>/dev/null | tail -n +8 | xargs -r rm -f

echo "Done."
