#!/usr/bin/env bash
# HTTP smoke checks for staging — no secrets printed.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${STAGING_ENV_FILE:-${ROOT_DIR}/deploy/.env}"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "${ENV_FILE}"
  set +a
fi

if [[ "${ENV:-}" == "production" ]]; then
  echo "FATAL: smoke-staging.sh cannot run against production." >&2
  exit 1
fi

BASE="${STAGING_BASE_URL:-http://127.0.0.1:${PLAIN_HTTP_PORT:-8080}}"
API="${BASE}/api"
PASS=0
FAIL=0

check() {
  local name="$1"
  local url="$2"
  local expect="${3:-200}"
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' "${url}" || true)"
  if [[ "${code}" == "${expect}" ]]; then
    echo "OK  ${name} (${code})"
    PASS=$((PASS + 1))
  else
    echo "FAIL ${name} expected ${expect} got ${code} — ${url}" >&2
    FAIL=$((FAIL + 1))
  fi
}

echo "==> Smoke staging @ ${BASE}"

check "Landing" "${BASE}/" 200
check "Health" "${API}/health" 200
check "Ready" "${API}/ready" 200
check "Frontend health" "${BASE}/health/frontend" 200

# Anonymous register blocked by rate limit is OK; login with bad creds should 401/400 not 500
code="$(curl -s -o /dev/null -w '%{http_code}' -X POST "${API}/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke-invalid@example.com","password":"wrong"}' || true)"
if [[ "${code}" =~ ^(400|401|422)$ ]]; then
  echo "OK  Login rejects invalid credentials (${code})"
  PASS=$((PASS + 1))
else
  echo "FAIL Login invalid creds expected 4xx got ${code}" >&2
  FAIL=$((FAIL + 1))
fi

if [[ -n "${OPENAI_API_KEY:-}" && "${ANALYZER_PROVIDER:-}" == "openai" ]]; then
  echo "OK  OpenAI configured (key present, not displayed)"
  PASS=$((PASS + 1))
else
  echo "FAIL OpenAI not configured for staging" >&2
  FAIL=$((FAIL + 1))
fi

if [[ "${EMAIL_PROVIDER:-}" == "smtp" && -n "${SMTP_HOST:-}" ]]; then
  echo "OK  SMTP configured (${SMTP_HOST})"
  PASS=$((PASS + 1))
else
  echo "FAIL SMTP not configured" >&2
  FAIL=$((FAIL + 1))
fi

if [[ "${STRIPE_SECRET_KEY:-}" == sk_test_* ]]; then
  echo "OK  Stripe test key prefix"
  PASS=$((PASS + 1))
elif [[ -n "${STRIPE_SECRET_KEY:-}" ]]; then
  echo "FAIL Stripe key must be sk_test_ in staging" >&2
  FAIL=$((FAIL + 1))
else
  echo "FAIL STRIPE_SECRET_KEY missing" >&2
  FAIL=$((FAIL + 1))
fi

echo "==> Summary: ${PASS} passed, ${FAIL} failed"
if [[ "${FAIL}" -gt 0 ]]; then
  exit 1
fi

echo "Staging smoke passed."
