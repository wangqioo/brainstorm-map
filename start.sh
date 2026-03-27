#!/bin/bash
# BrainMap - Quick Start Script for SPARK2
# Usage: ./start.sh [dev|prod]

MODE=${1:-dev}
ROOT=$(cd "$(dirname "$0")" && pwd)

echo "═══════════════════════════════════════════"
echo "  BrainMap · 启动中 (mode: $MODE)"
echo "═══════════════════════════════════════════"

# Load env if exists
if [ -f "$ROOT/backend/.env" ]; then
  echo "[.env] 加载配置..."
  export $(grep -v '^#' "$ROOT/backend/.env" | xargs)
fi

start_backend() {
  echo ""
  echo "[Backend] 安装依赖..."
  cd "$ROOT/backend"
  pip install -q -r requirements.txt

  echo "[Backend] 启动 FastAPI (port 8000)..."
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
  BACKEND_PID=$!
  echo "[Backend] PID: $BACKEND_PID"
}

start_frontend_dev() {
  echo ""
  echo "[Frontend] 安装依赖..."
  cd "$ROOT/frontend"
  npm install --silent

  echo "[Frontend] 启动 Vite dev server (port 5173)..."
  npm run dev &
  FRONTEND_PID=$!
  echo "[Frontend] PID: $FRONTEND_PID"
}

build_frontend() {
  echo ""
  echo "[Frontend] 安装依赖..."
  cd "$ROOT/frontend"
  npm install --silent

  echo "[Frontend] 构建生产版本..."
  npm run build
  echo "[Frontend] 构建完成 → frontend/dist/"
}

if [ "$MODE" = "prod" ]; then
  build_frontend
  start_backend
  echo ""
  echo "═══════════════════════════════════════════"
  echo "  访问: http://localhost:8000"
  echo "  Ctrl+C 停止"
  echo "═══════════════════════════════════════════"
  wait $BACKEND_PID

elif [ "$MODE" = "dev" ]; then
  start_backend
  start_frontend_dev
  echo ""
  echo "═══════════════════════════════════════════"
  echo "  Frontend: http://localhost:5173"
  echo "  Backend:  http://localhost:8000"
  echo "  API Docs: http://localhost:8000/docs"
  echo "  Ctrl+C 停止所有"
  echo "═══════════════════════════════════════════"

  # Trap Ctrl+C and kill both
  trap "echo ''; echo '停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT
  wait
fi
