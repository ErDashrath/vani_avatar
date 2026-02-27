#!/bin/bash
# EchoAI – start both backend and frontend

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "▶  Starting backend (port 8000)..."
pkill -f "uvicorn main:app" 2>/dev/null
cd "$ROOT/backend"
source venv/bin/activate
pip install -q -r requirements.txt
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > /tmp/echoai-backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID  |  log: /tmp/echoai-backend.log"

echo "▶  Starting frontend (port 5173)..."
cd "$ROOT"
npm run dev &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

echo ""
echo "✅  EchoAI running at  http://localhost:5173"
echo "   Backend API at      http://localhost:8000/api/health"
echo ""
echo "   Press Ctrl+C to stop both services."

# Wait and clean up both on exit
trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; pkill -f 'uvicorn main:app' 2>/dev/null; exit" INT TERM
wait
