#!/usr/bin/env bash
# Run database pre-flight check inside the backend container.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.yml"
ENV_FILE="${ROOT_DIR}/deploy/.env"

docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T backend \
  python scripts/check_database.py
