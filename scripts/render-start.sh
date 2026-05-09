#!/usr/bin/env bash
set -euo pipefail

# Ensure virtual environment is used
export PATH="/opt/venv/bin:$PATH"

# App ports
export PORT=${PORT:-10000}
PYTHON_PORT=${PYTHON_PORT:-8001}

SHUTDOWN_HANDLED=0

start_python() {
  echo "Starting Python FastAPI on port ${PYTHON_PORT}"

  python -m uvicorn analytics.main:app \
    --host 0.0.0.0 \
    --port "${PYTHON_PORT}" &
    
  PY_PID=$!
}

start_node() {
  echo "Starting Node app"

  npm start &
  NODE_PID=$!
}

term_handler() {
  if [ "${SHUTDOWN_HANDLED}" -eq 1 ]; then
    return
  fi

  SHUTDOWN_HANDLED=1

  echo "Shutting down..."

  if [ -n "${NODE_PID-}" ]; then
    kill -TERM "${NODE_PID}" 2>/dev/null || true
  fi

  if [ -n "${PY_PID-}" ]; then
    kill -TERM "${PY_PID}" 2>/dev/null || true
  fi

  wait || true
}

trap 'term_handler; exit 143' TERM INT

start_python
start_node

# Exit if either process exits
set +e
wait -n
EXIT_STATUS=$?
set -e

if [ -n "${NODE_PID-}" ] && ! kill -0 "${NODE_PID}" 2>/dev/null; then
  echo "Node app exited with status ${EXIT_STATUS}"
elif [ -n "${PY_PID-}" ] && ! kill -0 "${PY_PID}" 2>/dev/null; then
  echo "Python app exited with status ${EXIT_STATUS}"
else
  echo "A child process exited with status ${EXIT_STATUS}"
fi

term_handler

exit ${EXIT_STATUS}
