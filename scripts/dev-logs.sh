#!/usr/bin/env bash
# Usage: dev-logs.sh [svc]
# svc = optimizer | callagent | orchestrator | web | ngrok
# Defaults to orchestrator if unspecified.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
SVC="${1:-orchestrator}"

LOG="$ROOT/logs/${SVC}.log"

if [ ! -f "$LOG" ]; then
  echo "No log file at $LOG (service may not have started yet)"
  exit 1
fi

exec tail -f "$LOG"
