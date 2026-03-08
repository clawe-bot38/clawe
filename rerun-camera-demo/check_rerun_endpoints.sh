#!/usr/bin/env bash
set -euo pipefail

WEB_PORT="${RERUN_WEB_PORT:-9090}"
GRPC_PORT="${RERUN_GRPC_PORT:-9876}"

LAN_IP="$(hostname -I | awk '{print $1}')"

echo "== Socket check =="
ss -ltnp | awk 'NR==1 || /:(9090|9876)\s/'

echo ""
echo "== HTTP health (viewer root) =="
curl -fsSI "http://127.0.0.1:${WEB_PORT}/" | head -n 1

echo ""
echo "== Reachability URLs =="
echo "Local: http://127.0.0.1:${WEB_PORT}"
echo "LAN:   http://${LAN_IP}:${WEB_PORT}"
echo "gRPC:  rerun+http://${LAN_IP}:${GRPC_PORT}/proxy"
