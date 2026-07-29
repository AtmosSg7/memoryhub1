#!/usr/bin/env bash
# Full backup: MongoDB archive + uploads tarball.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.yml"
ENV_FILE="${ROOT_DIR}/deploy/.env"
BACKUP_DIR="${ROOT_DIR}/deploy/backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="${BACKUP_DIR}/backup-${TIMESTAMP}.log"

mkdir -p "${BACKUP_DIR}"

exec > >(tee -a "${LOG_FILE}") 2>&1

echo "=== MemoryHub backup started at ${TIMESTAMP} ==="

"${ROOT_DIR}/deploy/scripts/backup-mongodb.sh"
"${ROOT_DIR}/deploy/scripts/backup-uploads.sh"

echo "=== Backup completed ==="
