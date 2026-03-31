#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-3000}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if command -v python3 >/dev/null 2>&1; then
  PYTHON=python3
elif command -v python >/dev/null 2>&1; then
  PYTHON=python
else
  echo "python3 not found" >&2
  exit 1
fi

if command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "port $PORT is already in use" >&2
  exit 1
fi

echo "Serving: http://127.0.0.1:${PORT}/"
echo "LAN:     http://$(hostname -I | awk '{print $1}'):${PORT}/" 2>/dev/null || true

exec "$PYTHON" -m http.server "$PORT" --bind 0.0.0.0 --directory "$ROOT_DIR"
