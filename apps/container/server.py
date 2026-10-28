import json
import os
import subprocess
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse


def json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class PiHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        digits = params.get("digits", ["12"])[0]

        started_at = time.perf_counter()
        result = subprocess.run(
            [sys.executable, "/app/pi_task.py", digits],
            capture_output=True,
            text=True,
            check=False,
            timeout=10,
        )
        elapsed_ms = round((time.perf_counter() - started_at) * 1000, 2)

        if result.returncode != 0:
            json_response(
                self,
                400,
                {
                    "ok": False,
                    "error": result.stderr.strip() or "pi computation failed",
                    "elapsedMs": elapsed_ms,
                },
            )
            return

        json_response(
            self,
            200,
            {
                "ok": True,
                "digits": int(digits),
                "pi": result.stdout.strip(),
                "elapsedMs": elapsed_ms,
                "containerPid": self.server_pid,
            },
        )

    def log_message(self, format: str, *args) -> None:
        return

    @property
    def server_pid(self) -> int:
        return getattr(self.server, "pid", -1)


def main() -> None:
    server = HTTPServer(("0.0.0.0", 8080), PiHandler)
    server.pid = os.getpid()
    print("Pi container listening on :8080", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
