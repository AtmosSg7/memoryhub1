#!/usr/bin/env bash
# Validate staging environment file without printing secrets.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${STAGING_ENV_FILE:-${ROOT_DIR}/deploy/.env}"

redact() {
  sed -E 's/=(.*)$/=***/' "$1"
}

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: env file not found: ${ENV_FILE}" >&2
  echo "Copy deploy/.env.staging.example to deploy/.env and fill values." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "${ENV_FILE}"
set +a

if [[ "${ENV:-}" == "production" ]]; then
  echo "FATAL: refuse to validate production env with staging script." >&2
  exit 1
fi

if [[ "${ENV:-}" != "staging" ]]; then
  echo "ERROR: ENV must be 'staging' (got '${ENV:-unset}')." >&2
  exit 1
fi

echo "==> Staging env keys (values redacted)"
redact "${ENV_FILE}" | rg -v '^\s*(#|$)' || true

echo "==> Running backend validation"
docker compose -f "${ROOT_DIR}/docker-compose.yml" -f "${ROOT_DIR}/docker-compose.staging.yml" \
  --env-file "${ENV_FILE}" run --rm --no-deps backend \
  python -c "from env_validation import validate_production_env; validate_production_env(); print('staging env ok')"

echo "Staging environment validation passed."
