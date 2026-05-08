#!/usr/bin/env bash
set -euo pipefail

# Start both the Python FastAPI app and the Node app, and ensure child processes
# are terminated when the container receives SIGTERM/SIGINT.

PORT=${PORT:-8000}
PYTHON_PORT=${PYTHON_PORT:-8001}

start_python() {
  echo "Starting Python FastAPI on port ${PYTHON_PORT}"
  python3 -m uvicorn analytics.main:app --host 0.0.0.0 --port "${PYTHON_PORT}" &
  PY_PID=$!
}

start_node() {
  echo "Starting Node app"
  npm start &
  NODE_PID=$!
}

term_handler() {
  echo "Shutting down..."
  if [ -n "${NODE_PID-}" ]; then
    kill -TERM "${NODE_PID}" 2>/dev/null || true
  fi
  if [ -n "${PY_PID-}" ]; then
    kill -TERM "${PY_PID}" 2>/dev/null || true
  fi
  wait
}

trap term_handler TERM INT

start_python
start_node

# Wait for any process to exit and then terminate the other
wait -n
EXIT_STATUS=$?
term_handler
exit ${EXIT_STATUS}
