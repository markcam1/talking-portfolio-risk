#!/usr/bin/env bash
# Remove compliance bundles written during dev/testing.
# NEVER run this against production data.
#
# Usage:
#   ./scripts/dev-clear-compliance.sh            # removes all job bundles
#   ./scripts/dev-clear-compliance.sh <job_id>   # removes one bundle

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
ENV_FILE="$ROOT/backend/.env"

# Resolve DATA_DIR: prefer backend/.env, fall back to default
DATA_DIR="$ROOT/backend/data"
if [ -f "$ENV_FILE" ]; then
  _raw="$(grep -E '^DATA_DIR=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")"
  if [ -n "$_raw" ]; then
    # Resolve relative paths against the backend dir
    if [[ "$_raw" = /* ]]; then
      DATA_DIR="$_raw"
    else
      DATA_DIR="$ROOT/backend/$_raw"
    fi
  fi
fi

COMPLIANCE_DIR="$DATA_DIR/compliance"

if [ ! -d "$COMPLIANCE_DIR" ]; then
  echo "No compliance directory found at: $COMPLIANCE_DIR"
  exit 0
fi

JOB_ID="${1:-}"

if [ -n "$JOB_ID" ]; then
  TARGET="$COMPLIANCE_DIR/$JOB_ID"
  if [ ! -d "$TARGET" ]; then
    echo "Bundle not found: $TARGET"
    exit 1
  fi
  echo "==> Removing compliance bundle: $JOB_ID"
  rm -rf "$TARGET"
  echo "Done."
else
  BUNDLES=("$COMPLIANCE_DIR"/*/)
  if [ ! -e "${BUNDLES[0]}" ]; then
    echo "No compliance bundles to remove."
    exit 0
  fi
  echo "==> Removing all compliance bundles under: $COMPLIANCE_DIR"
  for bundle in "${BUNDLES[@]}"; do
    [ -d "$bundle" ] && echo "    rm $bundle" && rm -rf "$bundle"
  done
  echo "Done."
fi
