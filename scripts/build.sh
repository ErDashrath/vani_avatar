#!/usr/bin/env bash
# build.sh – Production build for frontend + backend.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "🏗️  Building Voice Avatar for production…"

# ── Frontend ──
cd "$ROOT/frontend"
npm ci
npx tsc -b
npx vite build
echo "✅ Frontend built → frontend/dist/"

# ── Backend ──
cd "$ROOT/backend"
if [ ! -d "venv" ]; then
  python3 -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt
echo "✅ Backend ready"

echo ""
echo "🚀 To run production:"
echo "   cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000"
echo "   Serve frontend/dist/ with a static server or reverse proxy."
