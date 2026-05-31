"""Static dashboard server for Cloud Run.

Serves the contents of this directory (`price_engine/`) over HTTP. Used by the
deployed Cloud Run service; the same script runs locally for parity. The
local-dev convenience server (`python -m http.server 8001 --directory ...`)
remains usable too — both serve the same tree.

Design choices:

- Pure Python stdlib (no Flask, no gunicorn). The dashboard is fully static
  HTML/CSS/JS + JSON; there is no server-side logic to host. A custom handler
  that subclasses `SimpleHTTPRequestHandler` is enough.
- `ThreadingHTTPServer` instead of the single-threaded default so concurrent
  requests do not block each other. Cloud Run typically gets 1–5 concurrent
  reads per cold container; threading is sufficient.
- Redirects `/` to `/dashboard/` so the Cloud Run root URL lands on the
  dashboard. Every other path resolves directly against the served tree.
- Reads `$PORT` per Cloud Run convention; defaults to 8080 for local runs.
- `os.chdir(SCRIPT_DIR)` keeps the served directory stable regardless of how
  the buildpack launches the process.
"""

from __future__ import annotations

import http.server
import os
import socketserver
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


class DashboardHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802 — stdlib API name
        # Land on the dashboard, not the directory listing.
        if self.path in ("", "/"):
            self.send_response(302)
            self.send_header("Location", "/dashboard/")
            self.end_headers()
            return
        return super().do_GET()

    def end_headers(self) -> None:  # noqa: N802 — stdlib API name
        # Cache discipline: HTML pages always revalidate so the browser
        # picks up a fresh build the next time it lands on the dashboard.
        # JS/CSS/JSON are safe to cache for a day because they carry
        # ?v=YYYYMMDD-N cache-bust query strings — a new build bumps the
        # token and forces a fresh fetch via URL change.
        #
        # This prevents the "stale sidebar / stale matrix" class of bug
        # where a returning user sees yesterday's HTML referencing
        # yesterday's asset versions.
        path = self.path.split("?", 1)[0].lower()
        if path.endswith(("/", ".html", ".htm")):
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        elif path.endswith((".js", ".css", ".json", ".svg", ".woff", ".woff2")):
            self.send_header("Cache-Control", "public, max-age=86400")
        super().end_headers()


def main() -> None:
    port = int(os.environ.get("PORT", "8080"))
    os.chdir(SCRIPT_DIR)
    # ThreadingHTTPServer is a stdlib subclass of HTTPServer with ThreadingMixIn.
    httpd = socketserver.ThreadingTCPServer(("0.0.0.0", port), DashboardHandler)
    httpd.allow_reuse_address = True
    print(f"[dashboard] serving {SCRIPT_DIR} on 0.0.0.0:{port}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("[dashboard] shutting down", flush=True)
    finally:
        httpd.server_close()


if __name__ == "__main__":
    sys.exit(main() or 0)
