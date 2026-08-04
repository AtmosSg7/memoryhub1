#!/usr/bin/env bash
# Shared docker compose invocation for production (OVH VPS).
# Usage from other scripts:
#   source deploy/scripts/compose-production.sh
#   compose_prod ps
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/deploy/.env"
COMPOSE_BASE="${ROOT_DIR}/docker-compose.yml"
COMPOSE_PROD="${ROOT_DIR}/docker-compose.production.yml"

if [[ ! -f "${COMPOSE_PROD}" ]]; then
  COMPOSE_PROD="${ROOT_DIR}/docker-compose.prod.yml"
fi

compose_prod() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    echo "Missing ${ENV_FILE}. Copy deploy/.env.production.example first." >&2
    exit 1
  fi
  docker compose \
    -f "${COMPOSE_BASE}" \
    -f "${COMPOSE_PROD}" \
    --env-file "${ENV_FILE}" \
    "$@"
}
