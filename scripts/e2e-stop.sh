#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for pidfile in "$ROOT/e2e/.backend.pid" "$ROOT/e2e/.frontend.pid"; do
  if [ -f "$pidfile" ]; then
    pid="$(cat "$pidfile")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" || true
      echo "Stopped PID $pid"
    fi
    rm -f "$pidfile"
  fi
done

echo "E2E stack stopped."
