#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
source .venv/bin/activate
export LD_LIBRARY_PATH="/nix/store/v8i33jvk4ddzny4qsp8ck7fpw5b0j9xm-ld-library-path/share/nix-ld/lib:${LD_LIBRARY_PATH:-}"
exec python camera_demo.py
