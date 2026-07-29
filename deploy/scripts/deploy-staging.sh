#!/usr/bin/env bash
# Idempotent staging deploy — refuses production.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${STAGING_ENV_FILE:-${ROOT_DIR}/deploy/.env}"
COMPOSE=(docker compose -f "${ROOT_DIR}/docker-compose.yml" -f "${ROOT_DIR}/docker-compose.staging.yml" --env-file "${ENV_FILE}")

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: missing ${ENV_FILE}" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "${ENV_FILE}"
set +a

if [[ "${ENV:-}" == "production" ]]; then
  echo "FATAL: deploy-staging.sh cannot run when ENV=production." >&2
  exit 1
fi

if [[ "${ENV:-}" != "staging" ]]; then
  echo "ERROR: ENV must be staging." >&2
  exit 1
fi

echo "==> Validate staging env"
"${ROOT_DIR}/deploy/scripts/validate-staging-env.sh"

echo "==> Build images"
"${COMPOSE[@]}" build

echo "==> Start stack"
"${COMPOSE[@]}" up -d

echo "==> Wait for readiness"
for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${PLAIN_HTTP_PORT:-8080}/health/backend/ready" > /dev/null 2>&1; then
    echo "Backend ready"
    break
  fi
  sleep 2
done

echo "==> Migrate indexes (idempotent)"
"${COMPOSE[@]}" exec -T backend python scripts/migrate_indexes.py || true

echo "Staging deploy complete."
