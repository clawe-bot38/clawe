# Rerun LAN Viewer (Best-Practice Setup)

This demo is a **true Rerun-backed** pipeline:

1. `rerun --serve-web` runs the official Rerun proxy + web viewer.
2. `rerun_scene_server.py` uses the Python SDK to stream data (scene + timelines + transforms + blueprint).
3. Remote clients open the viewer over LAN.

## Why this architecture

In some environments, `rr.serve_web_viewer()` can be awkward for LAN exposure/binding control.
Using the official `rerun --serve-web --bind 0.0.0.0` process is the recommended robust workaround while staying 100% Rerun-backed.

## Features in this scene

- Recording stream via `rr.RecordingStream` + `connect_grpc`
- Rerun archetypes: `Boxes3D`, `LineStrips3D`, `Arrows3D`, `Pinhole`, `Transform3D`, `Scalars`
- Timelines: `frame_nr` (sequence) + `sim_time` (duration)
- Blueprint/views: 3D view + time series panel
- Moving camera orbiting a cube, with live camera path

## Start

```bash
cd /home/clawe/.openclaw/workspace/rerun-camera-demo
./start_rerun_lan_viewer.sh
```

Default ports:
- gRPC proxy: `9876`
- web viewer: `9090`

Override if needed:

```bash
RERUN_GRPC_PORT=9988 RERUN_WEB_PORT=9191 ./start_rerun_lan_viewer.sh
```

## Connect from another machine

On host, get LAN IP:

```bash
hostname -I
```

Then from any LAN client browser:

- `http://<HOST_LAN_IP>:9090`

## Health check

```bash
./check_rerun_endpoints.sh
```

Expected:
- listeners on `:9090` and `:9876`
- HTTP 200 for `/`

## Optional user service (systemd)

Install:

```bash
mkdir -p ~/.config/systemd/user
cp rerun-lan-viewer.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now rerun-lan-viewer
```

Manage:

```bash
systemctl --user status rerun-lan-viewer
systemctl --user restart rerun-lan-viewer
journalctl --user -u rerun-lan-viewer -f
```
