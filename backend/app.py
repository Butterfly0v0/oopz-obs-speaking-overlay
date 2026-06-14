"""HTTP server used by OBS Browser Source.

The server exposes a transparent overlay page and streams normalized state from
OOPZ's built-in overlay WebSocket to the browser through Server-Sent Events.
"""

from __future__ import annotations

import json
import mimetypes
import sys
import tempfile
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from state import MockStateProvider, OopzOverlayProvider


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
DEFAULT_CONFIG = ROOT / "config.json"
EXAMPLE_CONFIG = ROOT / "config.example.json"


def load_config() -> dict[str, Any]:
    source = DEFAULT_CONFIG if DEFAULT_CONFIG.exists() else EXAMPLE_CONFIG
    with source.open("r", encoding="utf-8") as file:
        return json.load(file)


def ensure_config_file() -> Path:
    if not DEFAULT_CONFIG.exists():
        DEFAULT_CONFIG.write_text(EXAMPLE_CONFIG.read_text(encoding="utf-8"), encoding="utf-8")
    return DEFAULT_CONFIG


def save_overlay_config(config: dict[str, Any], overlay: dict[str, Any], mock_users: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    config_path = ensure_config_file()
    stored = load_config()
    stored["overlay"] = {**stored.get("overlay", {}), **overlay}
    if mock_users is not None:
        stored.setdefault("mock", {})
        stored["mock"]["users"] = mock_users
    with config_path.open("w", encoding="utf-8") as file:
        json.dump(stored, file, ensure_ascii=False, indent=2)
        file.write("\n")
    config["overlay"] = stored["overlay"]
    if mock_users is not None:
        config.setdefault("mock", {})
        config["mock"]["users"] = mock_users
    return {
        "overlay": stored["overlay"],
        "mock": {
            "users": stored.get("mock", {}).get("users", []),
        },
    }


class OverlayServer(ThreadingHTTPServer):
    def __init__(self, address: tuple[str, int], config: dict[str, Any]) -> None:
        super().__init__(address, OverlayRequestHandler)
        self.config = config
        self.provider = build_provider(config)


def build_provider(config: dict[str, Any]) -> MockStateProvider | OopzOverlayProvider:
    mode = str(config.get("oopz", {}).get("mode", "oopz-local")).lower()
    if mode == "mock":
        print("Using mock overlay data.")
        return MockStateProvider(config)

    print("Using OOPZ built-in overlay WebSocket data.")
    return OopzOverlayProvider(config)


class OverlayRequestHandler(BaseHTTPRequestHandler):
    server: OverlayServer

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[{self.log_date_time_string()}] {format % args}")

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        if path in ("/", "/overlay"):
            self.serve_file(FRONTEND / "index.html")
            return
        if path in ("/config", "/editor"):
            self.serve_file(FRONTEND / "config-editor.html")
            return
        if path == "/api/state":
            self.send_json(self.server.provider.snapshot().as_dict())
            return
        if path == "/api/config":
            self.send_json(self.public_config())
            return
        if path == "/events":
            self.serve_events()
            return
        if path == "/api/avatar":
            self.serve_avatar(parse_qs(parsed.query).get("path", [""])[0])
            return
        if path.startswith("/assets/"):
            self.serve_file(FRONTEND / path.lstrip("/"))
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/api/config":
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return

        length = int(self.headers.get("Content-Length", "0"))
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid JSON body")
            return

        overlay = payload.get("overlay")
        if not isinstance(overlay, dict):
            self.send_error(HTTPStatus.BAD_REQUEST, "Missing overlay object")
            return

        mock_users = payload.get("mockUsers")
        if mock_users is not None and not isinstance(mock_users, list):
            self.send_error(HTTPStatus.BAD_REQUEST, "mockUsers must be an array")
            return

        saved = save_overlay_config(self.server.config, overlay, mock_users)
        if mock_users is not None and str(self.server.config.get("oopz", {}).get("mode", "oopz-local")).lower() == "mock":
            self.server.provider = build_provider(self.server.config)
        self.send_json({"ok": True, **saved})

    def public_config(self) -> dict[str, Any]:
        config = self.server.config
        return {
            "overlay": config.get("overlay", {}),
            "oopz": {
                "mode": config.get("oopz", {}).get("mode", "oopz-local"),
            },
            "mock": {
                "users": config.get("mock", {}).get("users", []),
            },
        }

    def send_json(self, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_avatar(self, raw_path: str) -> None:
        if not raw_path:
            self.send_error(HTTPStatus.BAD_REQUEST, "Missing avatar path")
            return

        try:
            avatar_path = Path(raw_path).resolve(strict=True)
            allowed_root = (Path(tempfile.gettempdir()) / "oopz").resolve()
            if avatar_path != allowed_root and allowed_root not in avatar_path.parents:
                self.send_error(HTTPStatus.FORBIDDEN, "Avatar path is outside OOPZ temp cache")
                return
            body = avatar_path.read_bytes()
        except FileNotFoundError:
            self.send_error(HTTPStatus.NOT_FOUND, "Avatar not found")
            return

        content_type = mimetypes.guess_type(str(avatar_path))[0] or "image/png"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_file(self, path: Path) -> None:
        try:
            resolved = path.resolve()
            if FRONTEND.resolve() not in resolved.parents and resolved != FRONTEND.resolve():
                raise FileNotFoundError
            body = resolved.read_bytes()
        except FileNotFoundError:
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return

        content_type = mimetypes.guess_type(str(resolved))[0] or "application/octet-stream"
        if resolved.suffix == ".js":
            content_type = "text/javascript; charset=utf-8"
        elif resolved.suffix in (".html", ".css", ".svg"):
            content_type = f"{content_type}; charset=utf-8"

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_events(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.end_headers()

        try:
            while True:
                payload = json.dumps(self.server.provider.snapshot().as_dict(), ensure_ascii=False)
                self.wfile.write(f"event: state\ndata: {payload}\n\n".encode("utf-8"))
                self.wfile.flush()
                time.sleep(0.35)
        except (BrokenPipeError, ConnectionResetError):
            return


def main() -> None:
    config = load_config()
    server_config = config.get("server", {})
    host = str(server_config.get("host", "127.0.0.1"))
    port = int(server_config.get("port", 5173))

    httpd = OverlayServer((host, port), config)
    print(f"OOPZ OBS overlay server running at http://{host}:{port}/overlay")
    print(f"Visual config editor available at http://{host}:{port}/config")
    print("Keep OOPZ and its built-in overlay enabled while this server is running.")
    print("Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    try:
        main()
    except OSError as exc:
        print(f"Unable to start server: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
