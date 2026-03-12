#!/usr/bin/env bash
# Run the timebox CLI via tsx
# Usage: ./cli/run.sh <command> [args...]
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec npx tsx "$SCRIPT_DIR/index.ts" "$@"
