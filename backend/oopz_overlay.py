"""Client for the OOPZ built-in overlay localhost WebSocket.

OOPZ's own overlay process receives its data from a local WebSocket exposed by
the desktop client. The message we need looks like:

{
  "cmd": "members",
  "voice": true,
  "members": [
    {"name": "...", "avatar": "C:\\...\\avatar.png", "talking": false}
  ]
}

This module only opens a normal localhost WebSocket connection and reads those
messages. It does not inject into OOPZ, hook rendering, or inspect process
memory.
"""

from __future__ import annotations

import base64
import json
import os
import socket
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class OopzMember:
    name: str
    avatar_path: str = ""
    talking: bool = False
    muted: bool = False
    raw_id: str = ""


@dataclass
class OopzOverlaySnapshot:
    connected: bool = False
    voice: bool = False
    members: list[OopzMember] = field(default_factory=list)
    updated_at: float = field(default_factory=time.time)
    last_error: str = ""


class OopzOverlayClient:
    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 10274,
        path: str = "/",
        reconnect_delay: float = 2,
        on_message: Callable[[dict[str, Any]], None] | None = None,
        on_status: Callable[[bool, str], None] | None = None,
    ) -> None:
        self.host = host
        self.port = port
        self.path = path
        self.reconnect_delay = reconnect_delay
        self.on_message = on_message
        self.on_status = on_status
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._thread = threading.Thread(target=self._run, name="oopz-overlay-client", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                sock, leftover = websocket_handshake(self.host, self.port, self.path)
                self._emit_status(True, "")
                self._read_loop(sock, leftover)
            except Exception as exc:  # noqa: BLE001 - reconnect keeps the overlay available.
                self._emit_status(False, str(exc))
                self._stop.wait(self.reconnect_delay)

    def _read_loop(self, sock: socket.socket, leftover: bytes) -> None:
        sock.settimeout(1)
        reader = BufferedSocket(sock, leftover)
        try:
            while not self._stop.is_set():
                try:
                    opcode, payload = read_ws_frame(reader)
                except socket.timeout:
                    # OOPZ does not send a steady heartbeat. No new frame means
                    # "state unchanged", not "overlay disconnected".
                    continue
                if opcode == 1 and self.on_message:
                    message = json.loads(payload.decode("utf-8", errors="replace"))
                    self.on_message(message)
                elif opcode == 8:
                    break
        finally:
            sock.close()

    def _emit_status(self, connected: bool, error: str) -> None:
        if self.on_status:
            self.on_status(connected, error)


class BufferedSocket:
    def __init__(self, sock: socket.socket, initial: bytes = b"") -> None:
        self.sock = sock
        self.buffer = bytearray(initial)

    def recv_exact(self, size: int) -> bytes:
        while len(self.buffer) < size:
            chunk = self.sock.recv(size - len(self.buffer))
            if not chunk:
                raise EOFError("connection closed")
            self.buffer.extend(chunk)
        data = bytes(self.buffer[:size])
        del self.buffer[:size]
        return data


def websocket_handshake(host: str, port: int, path: str) -> tuple[socket.socket, bytes]:
    key = base64.b64encode(os.urandom(16)).decode("ascii")
    sock = socket.create_connection((host, port), timeout=3)
    request = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host}:{port}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        "Sec-WebSocket-Version: 13\r\n"
        "Origin: http://127.0.0.1\r\n"
        "\r\n"
    )
    sock.sendall(request.encode("ascii"))

    response = b""
    while b"\r\n\r\n" not in response:
        chunk = sock.recv(4096)
        if not chunk:
            raise EOFError("connection closed during handshake")
        response += chunk

    header, leftover = response.split(b"\r\n\r\n", 1)
    if b" 101 " not in header:
        raise RuntimeError(header.decode("utf-8", errors="replace"))
    return sock, leftover


def read_ws_frame(reader: BufferedSocket) -> tuple[int, bytes]:
    b1, b2 = reader.recv_exact(2)
    opcode = b1 & 0x0F
    masked = bool(b2 & 0x80)
    length = b2 & 0x7F

    if length == 126:
        length = int.from_bytes(reader.recv_exact(2), "big")
    elif length == 127:
        length = int.from_bytes(reader.recv_exact(8), "big")

    mask = reader.recv_exact(4) if masked else b""
    payload = reader.recv_exact(length) if length else b""
    if masked:
        payload = bytes(byte ^ mask[index % 4] for index, byte in enumerate(payload))
    return opcode, payload


def parse_members_message(message: dict[str, Any]) -> OopzOverlaySnapshot | None:
    if message.get("cmd") != "members":
        return None

    members = []
    for index, raw_member in enumerate(message.get("members", [])):
        if not isinstance(raw_member, dict):
            continue
        name = str(raw_member.get("name") or f"OOPZ User {index + 1}")
        raw_id = str(raw_member.get("uid") or raw_member.get("id") or name)
        members.append(
            OopzMember(
                name=name,
                raw_id=raw_id,
                avatar_path=str(raw_member.get("avatar") or ""),
                talking=bool(raw_member.get("talking")),
                muted=bool(raw_member.get("muted")),
            )
        )

    return OopzOverlaySnapshot(
        connected=True,
        voice=bool(message.get("voice")),
        members=members,
        updated_at=time.time(),
        last_error="",
    )
