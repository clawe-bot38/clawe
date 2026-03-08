#!/usr/bin/env python3
from __future__ import annotations

import base64
import json
import time
from collections import deque
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Optional


class Handler(BaseHTTPRequestHandler):
    server_version = "CubeDetect/2.0"

    def _send(self, code: int, payload: dict):
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self._send(204, {})

    def do_GET(self):
        if self.path.startswith("/health"):
            self._send(200, {"ok": True, "detector": "cube-color-cc", "ts": time.time()})
        else:
            self._send(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        if not self.path.startswith("/detect"):
            self._send(404, {"ok": False, "error": "not found"})
            return

        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        try:
            obj = json.loads(body.decode("utf-8"))
            width = int(obj.get("width", 0))
            height = int(obj.get("height", 0))
            rgba_b64 = obj.get("rgba", "")
            if not width or not height or not rgba_b64:
                raise ValueError("missing width/height/rgba")

            rgba = base64.b64decode(rgba_b64)
            exp = width * height * 4
            if len(rgba) != exp:
                raise ValueError(f"invalid rgba size {len(rgba)} != {exp}")

            det = detect_cube_color_cc(rgba, width, height)

            out = {
                "ok": True,
                "model": "cube-color-cc-v2",
                "confidence_format": "0..1 float",
                "bbox_format": "normalized xywh (top-left x,y, width, height)",
                "detections": [],
            }
            if det:
                out["detections"].append(det)
            self._send(200, out)
        except Exception as e:
            self._send(400, {"ok": False, "error": str(e)})


def _is_cube_color(r: int, g: int, b: int) -> bool:
    # Cube uses MeshBasicMaterial color ~#00E5FF. Match cyan strongly and reject blue/purple spill.
    if g < 110 or b < 130:
        return False
    if r > 90:
        return False
    if (g + b - 2 * r) < 210:
        return False
    # keep close to cyan (g and b both high and not too far apart)
    if abs(g - b) > 95:
        return False
    return True


def detect_cube_color_cc(rgba: bytes, width: int, height: int) -> Optional[dict]:
    total_px = width * height
    mask = bytearray(total_px)

    # 1) Color mask
    for p in range(total_px):
        i = p * 4
        if _is_cube_color(rgba[i], rgba[i + 1], rgba[i + 2]):
            mask[p] = 1

    if sum(mask) < 80:
        return None

    # 2) Largest connected component (4-neighborhood)
    visited = bytearray(total_px)
    best = None
    best_area = 0

    for start in range(total_px):
        if not mask[start] or visited[start]:
            continue

        q = deque([start])
        visited[start] = 1

        area = 0
        x0, y0 = width, height
        x1, y1 = -1, -1

        while q:
            p = q.popleft()
            area += 1
            x = p % width
            y = p // width

            if x < x0:
                x0 = x
            if y < y0:
                y0 = y
            if x > x1:
                x1 = x
            if y > y1:
                y1 = y

            # left
            if x > 0:
                n = p - 1
                if mask[n] and not visited[n]:
                    visited[n] = 1
                    q.append(n)
            # right
            if x + 1 < width:
                n = p + 1
                if mask[n] and not visited[n]:
                    visited[n] = 1
                    q.append(n)
            # up
            if y > 0:
                n = p - width
                if mask[n] and not visited[n]:
                    visited[n] = 1
                    q.append(n)
            # down
            if y + 1 < height:
                n = p + width
                if mask[n] and not visited[n]:
                    visited[n] = 1
                    q.append(n)

        if area > best_area:
            best_area = area
            best = (x0, y0, x1, y1, area)

    if not best:
        return None

    x0, y0, x1, y1, count = best
    bw = x1 - x0 + 1
    bh = y1 - y0 + 1
    box_area = max(1, bw * bh)

    # Require a roughly square component (cube projection can vary but not extreme)
    aspect = bw / max(1, bh)
    if aspect < 0.45 or aspect > 2.2:
        return None

    fill_ratio = count / box_area
    area_ratio = box_area / max(1, total_px)

    # Confidence from compactness and meaningful area
    conf = 0.25 + 0.55 * min(1.0, fill_ratio / 0.75) + 0.20 * min(1.0, area_ratio * 18.0)
    conf = max(0.0, min(0.995, conf))

    return {
        "label": "cube",
        "confidence": round(conf, 4),
        "bbox": {
            "x": round(x0 / width, 5),
            "y": round(y0 / height, 5),
            "width": round(bw / width, 5),
            "height": round(bh / height, 5),
        },
        "debug": {
            "mask_pixels": count,
            "fill_ratio": round(fill_ratio, 4),
            "area_ratio": round(area_ratio, 4),
            "aspect": round(aspect, 3),
        },
    }


def main():
    srv = HTTPServer(("0.0.0.0", 3202), Handler)
    print("Cube detector listening on http://0.0.0.0:3202")
    srv.serve_forever()


if __name__ == "__main__":
    main()
