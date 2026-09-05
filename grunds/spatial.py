"""Grunds — spatial: the Three.js floor.

Zones (counter, tables, register, retail shelf), entity spawning keyed on
transaction time, queue heat, and gossip bubbles. The floorplan is the chart.

Serves web/ at http://localhost:8787 with /api/schedule backed by
out/wave_schedule.json (regenerate with `python3 -m grunds.ingest`).
"""

from __future__ import annotations

from functools import partial
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
SCHEDULE = ROOT / "out" / "wave_schedule.json"
PORT = 8787


def _api_schedule(handler: SimpleHTTPRequestHandler) -> None:
    body = SCHEDULE.read_bytes()
    handler.send_response(200)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    def do_GET(self):  # noqa: N802
        if self.path == "/api/schedule":
            _api_schedule(self)
            return
        super().do_GET()

    def log_message(self, fmt, *args):
        if self.path.startswith("/api/"):
            return
        super().log_message(fmt, *args)


def main() -> None:
    if not SCHEDULE.exists():
        from grunds import ingest

        ingest.main()
    print(f"spatial: The District floor at http://localhost:{PORT}")
    HTTPServer(("127.0.0.1", PORT), partial(Handler)).serve_forever()


if __name__ == "__main__":
    main()



