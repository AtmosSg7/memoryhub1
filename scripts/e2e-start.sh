#!/usr/bin/env bash
# Start isolated E2E stack (Mongo must already run locally).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ENV=development
export E2E_DB_NAME="${E2E_DB_NAME:-memoryhub_e2e}"
export DB_NAME="$E2E_DB_NAME"
export MONGO_URL="${MONGO_URL:-mongodb://localhost:27017}"
export JWT_SECRET="${JWT_SECRET:-e2e-jwt-secret-at-least-32-characters-long}"
export EMAIL_PROVIDER=fake
export ANALYZER_PROVIDER=mock
export E2E_DISABLE_RATE_LIMIT=1
export CREDITS_ENFORCED=true
export ALLOW_E2E_SEED=1
export STRIPE_BACKEND="${STRIPE_BACKEND:-fake}"

echo "==> Reset E2E database"
python3 "$ROOT/backend/scripts/clean_e2e_db.py"
python3 "$ROOT/backend/scripts/seed_e2e.py"

echo "==> Start backend on :8000"
cd "$ROOT/backend"
if [ -d .venv ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi
nohup uvicorn server:app --host 127.0.0.1 --port 8000 \
  > "$ROOT/e2e/.backend.log" 2>&1 &
BACKEND_PID=$!
if command -v setsid >/dev/null 2>&1; then
  disown "$BACKEND_PID" 2>/dev/null || true
fi
echo "$BACKEND_PID" > "$ROOT/e2e/.backend.pid"

echo "==> Start frontend dev server on :3000 (API proxied to :8000)"
cd "$ROOT/frontend"
nohup env BROWSER=none HOST=127.0.0.1 PORT=3000 npm start \
  > "$ROOT/e2e/.frontend.log" 2>&1 &
FRONTEND_PID=$!
if command -v setsid >/dev/null 2>&1; then
  disown "$FRONTEND_PID" 2>/dev/null || true
fi
echo "$FRONTEND_PID" > "$ROOT/e2e/.frontend.pid"

echo "==> Waiting for services"
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:8000/api/health > /dev/null 2>&1; then
    break
  fi
  sleep 1
done
for i in $(seq 1 90); do
  if curl -sf http://127.0.0.1:3000/ > /dev/null 2>&1; then
    break
  fi
  sleep 2
done
if ! curl -sf http://127.0.0.1:3000/ > /dev/null 2>&1; then
  echo "ERROR: frontend did not become ready — see $ROOT/e2e/.frontend.log" >&2
  exit 1
fi

echo "Stack ready:"
echo "  backend PID=$BACKEND_PID"
echo "  frontend PID=$FRONTEND_PID"
echo "  artisan-a: artisan-a@e2e.example.com / E2ePassw0rd!A"
echo "  admin: admin@e2e.example.com / E2eAdminPass1!"
