#!/usr/bin/env python3
from __future__ import annotations

import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 3000
BIND = "0.0.0.0"


class NoCacheHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def guess_type(self, path):
        if path.endswith(".urdf"):
            return "application/xml"
        return super().guess_type(path)


if __name__ == "__main__":
    os.chdir(ROOT)
    server = ThreadingHTTPServer((BIND, PORT), NoCacheHandler)
    print(f"Robot viewer serving {ROOT} on http://{BIND}:{PORT}")
    server.serve_forever()
