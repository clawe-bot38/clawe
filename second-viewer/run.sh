#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Static scene server (LAN-reachable)
python3 -m http.server 3201 --bind 0.0.0.0 >/tmp/second-viewer-3201.log 2>&1 &
SCENE_PID=$!

# Detector backend (LAN-reachable)
python3 detect_server.py >/tmp/second-viewer-3202.log 2>&1 &
DET_PID=$!

HOST_IP="$(hostname -I | awk '{print $1}')"

echo "Scene URL (local): http://localhost:3201"
echo "Scene URL (LAN):   http://${HOST_IP}:3201"
echo "Detect API:         http://${HOST_IP}:3202/detect"
echo "Health API:         http://${HOST_IP}:3202/health"
echo "PIDs: scene=$SCENE_PID detector=$DET_PID"
echo "Logs: /tmp/second-viewer-3201.log /tmp/second-viewer-3202.log"

wait
