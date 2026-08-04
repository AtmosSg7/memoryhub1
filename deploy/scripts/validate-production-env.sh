#!/usr/bin/env bash
# Validate deploy/.env against production readiness (no secret values printed).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/deploy/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Copy deploy/.env.production.example → deploy/.env"
  exit 1
fi

echo "Validating ${ENV_FILE}…"

MISSING=0

require() {
  local key="$1"
  local line val
  line="$(grep -E "^${key}=" "${ENV_FILE}" | head -1 || true)"
  if [[ -z "${line}" ]]; then
    echo "  ✗ ${key} missing"
    MISSING=1
    return
  fi
  val="${line#*=}"
  if [[ -z "${val}" || "${val}" == *CHANGE_ME* ]]; then
    echo "  ✗ ${key} empty or still CHANGE_ME"
    MISSING=1
  else
    echo "  ✓ ${key}"
  fi
}

echo "Required keys:"
for key in \
  ENV \
  PUBLIC_APP_URL \
  FRONTEND_URL \
  FRONTEND_PUBLIC_URL \
  BACKEND_PUBLIC_URL \
  PORTAL_BASE_URL \
  CORS_ORIGINS \
  JWT_SECRET \
  SENTRY_USER_SALT \
  MONGO_ROOT_USERNAME \
  MONGO_ROOT_PASSWORD \
  DB_NAME \
  STORAGE_BACKEND \
  LOCAL_UPLOAD_DIR \
  CREDITS_ENFORCED \
  ANALYZER_PROVIDER \
  OPENAI_API_KEY \
  EMAIL_PROVIDER \
  SMTP_HOST \
  SMTP_FROM_EMAIL \
  SUPPORT_EMAIL \
  STRIPE_SECRET_KEY \
  STRIPE_WEBHOOK_SECRET \
  STRIPE_PRICE_SOLO \
  STRIPE_PRICE_PRO \
  STRIPE_PRICE_TEAM \
  STRIPE_SUCCESS_URL \
  STRIPE_CANCEL_URL
do
  require "${key}"
done

if grep -qE "^ENV=production$" "${ENV_FILE}"; then
  echo "  ✓ ENV=production"
else
  echo "  ✗ ENV must be exactly production"
  MISSING=1
fi

if [[ ! -f "${ROOT_DIR}/deploy/certs/fullchain.pem" || ! -f "${ROOT_DIR}/deploy/certs/privkey.pem" ]]; then
  echo "  ✗ TLS certs missing in deploy/certs/ (run generate-self-signed-certs.sh before first up)"
  MISSING=1
else
  echo "  ✓ deploy/certs/fullchain.pem + privkey.pem"
fi

if command -v docker >/dev/null 2>&1; then
  if docker compose \
    -f "${ROOT_DIR}/docker-compose.yml" \
    -f "${ROOT_DIR}/docker-compose.production.yml" \
    --env-file "${ENV_FILE}" \
    config >/dev/null 2>&1; then
    echo "  ✓ docker compose config (production overlay)"
  else
    echo "  ✗ docker compose config failed — check YAML / MONGO_ROOT_* interpolation"
    MISSING=1
  fi
else
  echo "  · docker not available on this machine — skipped compose config check"
fi

if [[ "${MISSING}" -ne 0 ]]; then
  echo "Validation FAILED — fix the items above."
  exit 1
fi

echo "Basic validation PASSED."
echo "After stack start, run inside backend:"
echo "  docker compose -f docker-compose.yml -f docker-compose.production.yml --env-file deploy/.env exec backend python -c \"from env_validation import validate_production_env; validate_production_env(); print('OK')\""
