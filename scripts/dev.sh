#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

OPTIMIZER_DIR="$ROOT/optimizer"
CALLAGENT_DIR="$ROOT/call-agent"
CALLAGENT_ENV="$CALLAGENT_DIR/.env"

mkdir -p "$ROOT/logs" "$ROOT/.dev"
: > "$ROOT/.dev/pids"  # truncate PID file

# Export root .env so all child processes (orchestrator, call-agent, etc.) inherit it
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

echo "==> Starting ngrok on port 3334…"
ngrok http 3334 > "$ROOT/logs/ngrok.log" 2>&1 &
echo $! >> "$ROOT/.dev/pids"

# Wait for ngrok API to be ready
echo -n "    Waiting for ngrok tunnel"
for i in $(seq 1 30); do
  PUBLIC_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4 || true)
  if [ -n "$PUBLIC_URL" ]; then
    echo " → $PUBLIC_URL"
    break
  fi
  echo -n "."
  sleep 1
done

if [ -n "$PUBLIC_URL" ]; then
  echo "==> Wiring PUBLIC_URL=$PUBLIC_URL into call agent .env"
  if grep -q "^PUBLIC_URL=" "$CALLAGENT_ENV" 2>/dev/null; then
    sed -i "s|^PUBLIC_URL=.*|PUBLIC_URL=${PUBLIC_URL}|" "$CALLAGENT_ENV"
  else
    echo "PUBLIC_URL=${PUBLIC_URL}" >> "$CALLAGENT_ENV"
  fi
else
  echo "    WARNING: ngrok tunnel not found; call agent PUBLIC_URL unchanged"
fi

echo "==> Starting Portfolio Optimizer (:8077)…"
(
  cd "$OPTIMIZER_DIR"
  nohup "$OPTIMIZER_DIR/venv/bin/python" -m uvicorn main:app --host 127.0.0.1 --port 8077 \
    > "$ROOT/logs/optimizer.log" 2>&1
) &
echo $! >> "$ROOT/.dev/pids"

echo "==> Starting Call Agent (:3334)…"
(
  cd "$CALLAGENT_DIR"
  nohup node --import tsx server.ts > "$ROOT/logs/callagent.log" 2>&1
) &
echo $! >> "$ROOT/.dev/pids"

echo "==> Starting Orchestrator (:5179)…"
(
  cd "$ROOT/backend"
  nohup npx tsx src/server.ts > "$ROOT/logs/orchestrator.log" 2>&1
) &
echo $! >> "$ROOT/.dev/pids"

echo "==> Starting Web UI (:5180)…"
(
  cd "$ROOT/frontend"
  nohup npx vite --port 5180 > "$ROOT/logs/web.log" 2>&1
) &
echo $! >> "$ROOT/.dev/pids"

echo "==> Starting Optimizer Web (:5181)…"
(
  cd "$ROOT/optimizer-web"
  nohup npx vite --port 5181 > "$ROOT/logs/optimizer-web.log" 2>&1
) &
echo $! >> "$ROOT/.dev/pids"

# Health-check
echo ""
echo "==> Waiting for services to start…"
sleep 6

check_port() {
  curl -s --max-time 2 "http://127.0.0.1:$1" > /dev/null 2>&1 && echo "ok" || echo "not ready"
}

echo ""
echo "=== Talking Portfolio Dev Stack ==="
echo "  Web UI:           http://127.0.0.1:5180  ($(check_port 5180))"
echo "  Optimizer Web:    http://127.0.0.1:5181  ($(check_port 5181))"
echo "  Orchestrator:     http://127.0.0.1:5179  ($(check_port 5179))"
echo "  Call Agent:       http://127.0.0.1:3334  ($(check_port 3334))"
echo "  Optimizer API:    http://127.0.0.1:8077  ($(check_port 8077))"
[ -n "${PUBLIC_URL:-}" ] && echo "  Ngrok:            $PUBLIC_URL"
echo ""
echo "  Logs:    $ROOT/logs/<svc>.log"
echo "  Stop:    scripts/dev-stop.sh"
echo "  Tail:    scripts/dev-logs.sh [svc]"
echo ""
