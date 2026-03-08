#!/usr/bin/env bash
set -euo pipefail

cd "/home/clawe/.openclaw/workspace/rerun-camera-demo"

if [[ ! -f .venv/bin/activate ]]; then
  echo "Missing virtualenv at .venv. Create it first." >&2
  exit 1
fi

source .venv/bin/activate
export LD_LIBRARY_PATH="/nix/store/v8i33jvk4ddzny4qsp8ck7fpw5b0j9xm-ld-library-path/share/nix-ld/lib:${LD_LIBRARY_PATH:-}"

BIND_HOST="${RERUN_BIND_HOST:-0.0.0.0}"
GRPC_PORT="${RERUN_GRPC_PORT:-9876}"
WEB_PORT="${RERUN_WEB_PORT:-9090}"

# SDK logger connects locally to the Rerun proxy server.
export RERUN_GRPC_ADDR="${RERUN_GRPC_ADDR:-rerun+http://127.0.0.1:${GRPC_PORT}/proxy}"

cleanup() {
  local code=$?
  if [[ -n "${LOGGER_PID:-}" ]] && kill -0 "$LOGGER_PID" 2>/dev/null; then
    kill "$LOGGER_PID" 2>/dev/null || true
  fi
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  wait || true
  exit "$code"
}
trap cleanup EXIT INT TERM

rerun \
  --serve-web \
  --bind "$BIND_HOST" \
  --port "$GRPC_PORT" \
  --web-viewer-port "$WEB_PORT" \
  --server-memory-limit "1GiB" \
  --memory-limit "25%" \
  --newest-first &
SERVER_PID=$!

# Give the proxy server a moment to bind before SDK connects.
sleep 1

python rerun_scene_server.py &
LOGGER_PID=$!

LAN_IP="$(hostname -I | awk '{print $1}')"

echo ""
echo "Rerun LAN viewer is up"
echo "  Web viewer: http://${LAN_IP}:${WEB_PORT}"
echo "  gRPC proxy: rerun+http://${LAN_IP}:${GRPC_PORT}/proxy"
echo "Press Ctrl+C to stop."
echo ""

wait
