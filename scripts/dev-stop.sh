#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
PIDS_FILE="$ROOT/.dev/pids"

if [ -f "$PIDS_FILE" ]; then
  echo "==> Killing service PIDs…"
  while IFS= read -r pid; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" && echo "    killed $pid"
    fi
  done < "$PIDS_FILE"
  : > "$PIDS_FILE"
fi

echo "==> Killing ngrok…"
pkill -f "ngrok http" 2>/dev/null || true
pkill -f "ngrok" 2>/dev/null || true

echo "==> Clearing dev ports (5179 5180 5181 3334 8077)…"
for port in 5179 5180 5181 3334 8077; do
  lsof -ti ":$port" 2>/dev/null | xargs kill -9 2>/dev/null || true
done

echo "Done."
