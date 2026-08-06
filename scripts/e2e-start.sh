#!/usr/bin/env bash
# Start isolated E2E stack (Mongo must already run locally).
# Uses dedicated ports 8001/3001 so the normal local stack (8000/3000) is never hijacked.
# Never writes backend/.env or frontend/.env.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/e2e"

E2E_DB_NAME="${E2E_DB_NAME:-memoryhub_e2e}"
E2E_BACKEND_PORT="${E2E_BACKEND_PORT:-8001}"
E2E_FRONTEND_PORT="${E2E_FRONTEND_PORT:-3001}"
MONGO_URL="${MONGO_URL:-mongodb://localhost:27017}"

if [ "$E2E_DB_NAME" = "memoryhub" ]; then
  echo "ERROR: Refusing to start E2E against protected DB_NAME=memoryhub" >&2
  exit 2
fi

# Build a clean env for children (do not inherit caller's DB_NAME / JWT_SECRET / ALLOW_E2E_SEED).
run_e2e_env() {
  env -i \
    PATH="$PATH" \
    HOME="${HOME:-}" \
    USER="${USER:-}" \
    LANG="${LANG:-}" \
    LC_ALL="${LC_ALL:-}" \
    VIRTUAL_ENV="${VIRTUAL_ENV:-}" \
    ENV=development \
    E2E_DB_NAME="$E2E_DB_NAME" \
    DB_NAME="$E2E_DB_NAME" \
    MONGO_URL="$MONGO_URL" \
    JWT_SECRET="e2e-jwt-secret-at-least-32-characters-long" \
    EMAIL_PROVIDER=fake \
    ANALYZER_PROVIDER=mock \
    E2E_DISABLE_RATE_LIMIT=1 \
    ALLOW_E2E_SEED=1 \
    STRIPE_BACKEND=fake \
    INTEGRATIONS_GMAIL_PROVIDER=mock \
    INTEGRATIONS_CONTACTS_PROVIDER=mock \
    INTEGRATIONS_TOKEN_KEY="e2e-integrations-token-key-32chars!!" \
    ACTION_ENGINE_ENABLED=true \
    COMMUNICATION_INTELLIGENCE_ENABLED=true \
    COMMUNICATION_INTELLIGENCE_PROVIDER=mock \
    COMMUNICATION_INTELLIGENCE_AUTO_ON_INGEST=false \
    CREDITS_ENFORCED=false \
    GMAIL_AUTO_SYNC_ENABLED=false \
    BACKEND_PUBLIC_URL="http://127.0.0.1:${E2E_BACKEND_PORT}" \
    PUBLIC_APP_URL="http://127.0.0.1:${E2E_FRONTEND_PORT}" \
    "$@"
}

echo "==> Reset E2E database ($E2E_DB_NAME) — never touches memoryhub"
cd "$ROOT/backend"
if [ -d .venv ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi
run_e2e_env python3 scripts/clean_e2e_db.py
run_e2e_env python3 scripts/seed_e2e.py

echo "==> Start E2E backend on :${E2E_BACKEND_PORT} (DB=$E2E_DB_NAME)"
run_e2e_env nohup python3 -m uvicorn server:app --host 127.0.0.1 --port "$E2E_BACKEND_PORT" \
  > "$ROOT/e2e/.backend.log" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$ROOT/e2e/.backend.pid"

echo "==> Start E2E frontend on :${E2E_FRONTEND_PORT} (proxy -> :${E2E_BACKEND_PORT})"
cd "$ROOT/frontend"
run_e2e_env env \
  BROWSER=none \
  HOST=127.0.0.1 \
  PORT="$E2E_FRONTEND_PORT" \
  E2E_PROXY_TARGET="http://127.0.0.1:${E2E_BACKEND_PORT}" \
  nohup npm start > "$ROOT/e2e/.frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > "$ROOT/e2e/.frontend.pid"

echo "==> Waiting for services"
for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${E2E_BACKEND_PORT}/api/health" > /dev/null 2>&1; then
    break
  fi
  sleep 1
done
for i in $(seq 1 90); do
  if curl -sf "http://127.0.0.1:${E2E_FRONTEND_PORT}/" > /dev/null 2>&1; then
    break
  fi
  sleep 2
done
if ! curl -sf "http://127.0.0.1:${E2E_FRONTEND_PORT}/" > /dev/null 2>&1; then
  echo "ERROR: E2E frontend did not become ready — see $ROOT/e2e/.frontend.log" >&2
  exit 1
fi

printf 'BACKEND=%s\nFRONTEND=%s\nDB=%s\n' "$E2E_BACKEND_PORT" "$E2E_FRONTEND_PORT" "$E2E_DB_NAME" \
  > "$ROOT/e2e/.ports"

echo "E2E stack ready (isolated from local :8000/:3000):"
echo "  backend  http://127.0.0.1:${E2E_BACKEND_PORT}  PID=$BACKEND_PID  DB=$E2E_DB_NAME"
echo "  frontend http://127.0.0.1:${E2E_FRONTEND_PORT}  PID=$FRONTEND_PID"
echo "  Playwright: E2E_BASE_URL=http://127.0.0.1:${E2E_FRONTEND_PORT}"
echo "  artisan-a: artisan-a@e2e.example.com / E2ePassw0rd!A"
echo "  admin: admin@e2e.example.com / E2eAdminPass1!"
