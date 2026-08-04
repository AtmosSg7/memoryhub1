#!/usr/bin/env bash
# Prepare a local Basera demo account: create dev user, seed demo_v2, print login.
# Blocked when ENV=production (scripts themselves enforce this).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"

if [[ "${ENV:-}" == "production" ]]; then
  echo "Refusing to run: ENV=production"
  exit 1
fi

cd "$BACKEND"

echo "==> Seed / ensure dev user"
python3 scripts/seed_dev_user.py

echo "==> Seed demo_v2 dataset"
python3 scripts/seed_dev_demo.py

echo ""
echo "Demo ready."
echo "  Login:  atmossg7@gmail.com"
echo "  Pass:   devpassword123"
echo "  App:    http://localhost:3000/login"
echo ""
echo "Clear demo data later with:"
echo "  cd backend && python3 scripts/clear_dev_demo.py"
