#!/usr/bin/env bash
# dev.sh – Start both backend and frontend dev servers in parallel.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "🚀 Starting Voice Avatar development servers…"
echo ""

# ── Backend ──
(
  cd "$ROOT/backend"
  if [ ! -d "venv" ]; then
    echo "📦 Creating Python venv…"
    python3 -m venv venv
  fi
  source venv/bin/activate

  echo "📦 Installing Python deps…"
  pip install -q -r requirements.txt

  cp -n .env.example .env 2>/dev/null || true

  echo "🐍 Starting FastAPI on :8000"
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
) &

# ── Frontend ──
(
  cd "$ROOT/frontend"

  if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node deps…"
    npm install
  fi

  echo "⚛️  Starting Vite on :5173"
  npx vite --host
) &

wait
