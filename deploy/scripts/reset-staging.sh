#!/usr/bin/env bash
# Reset staging MongoDB volume — DESTRUCTIVE, staging only.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${STAGING_ENV_FILE:-${ROOT_DIR}/deploy/.env}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: missing ${ENV_FILE}" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "${ENV_FILE}"
set +a

if [[ "${ENV:-}" == "production" ]]; then
  echo "FATAL: reset-staging.sh cannot run when ENV=production." >&2
  exit 1
fi

if [[ "${ENV:-}" != "staging" ]]; then
  echo "ERROR: ENV must be staging." >&2
  exit 1
fi

if [[ "${CONFIRM_STAGING_RESET:-}" != "yes" ]]; then
  echo "Set CONFIRM_STAGING_RESET=yes to drop staging database volume." >&2
  exit 1
fi

COMPOSE=(docker compose -f "${ROOT_DIR}/docker-compose.yml" -f "${ROOT_DIR}/docker-compose.staging.yml" --env-file "${ENV_FILE}")

echo "==> Stopping stack"
"${COMPOSE[@]}" down

echo "==> Removing staging mongo volume"
docker volume rm memoryhub_mongo_staging_data 2>/dev/null || docker volume rm "$(basename "${ROOT_DIR}")_mongo_staging_data" 2>/dev/null || true

echo "==> Restarting stack"
"${COMPOSE[@]}" up -d

echo "Staging reset complete. Promote admin and re-seed as needed."
