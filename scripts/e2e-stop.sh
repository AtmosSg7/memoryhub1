#!/usr/bin/env bash
# Stop the isolated E2E stack only. Does not touch a separately running local :8000/:3000 stack.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for pidfile in "$ROOT/e2e/.backend.pid" "$ROOT/e2e/.frontend.pid"; do
  if [ -f "$pidfile" ]; then
    pid="$(cat "$pidfile")"
    if kill -0 "$pid" 2>/dev/null; then
      # Kill process group children when possible
      pkill -P "$pid" 2>/dev/null || true
      kill "$pid" 2>/dev/null || true
      echo "Stopped E2E PID $pid"
    fi
    rm -f "$pidfile"
  fi
done

rm -f "$ROOT/e2e/.ports"
echo "E2E stack stopped. Local stack (:8000/:3000, DB memoryhub) was not modified."
