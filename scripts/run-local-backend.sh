#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f "$ROOT_DIR/frontend/.env" ]]; then
  echo "[local-backend] Missing frontend/.env. Prepare the frontend local env first." >&2
  exit 1
fi

if [[ ! -x "$ROOT_DIR/venv/bin/uvicorn" ]]; then
  echo "[local-backend] Missing ./venv/bin/uvicorn. Install backend dependencies first." >&2
  exit 1
fi

if lsof -nP -iTCP:8000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "[local-backend] Port 8000 is already in use." >&2
  echo "[local-backend] If the old Docker backend is occupying it, run: docker stop ervis-backend-1" >&2
  exit 1
fi

exec "$ROOT_DIR/venv/bin/uvicorn" api:app --host 127.0.0.1 --port 8000
