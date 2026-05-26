"""Overlay state model and providers."""

from __future__ import annotations

import hashlib
import itertools
import threading
import time
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import quote

from oopz_overlay import OopzOverlayClient, OopzOverlaySnapshot, parse_members_message


PALETTE = [
    "#ff6b6b",
    "#ffd166",
    "#06d6a0",
    "#4cc9f0",
    "#a78bfa",
    "#f472b6",
    "#fb923c",
    "#84cc16",
]


@dataclass
class OverlayUser:
    id: str
    display_name: str
    avatar_url: str = ""
    speaking: bool = False
    color: str = ""
    muted: bool = False

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "displayName": self.display_name,
            "avatarUrl": self.avatar_url,
            "speaking": self.speaking,
            "color": self.color or stable_color(self.id),
            "muted": self.muted,
        }


@dataclass
class OverlayState:
    users: list[OverlayUser] = field(default_factory=list)
    updated_at: float = field(default_factory=time.time)
    source: str = "mock"
    connected: bool = True
    voice: bool = False
    last_error: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "updatedAt": self.updated_at,
            "connected": self.connected,
            "voice": self.voice,
            "lastError": self.last_error,
            "users": [user.as_dict() for user in self.users],
        }


def stable_color(user_id: str) -> str:
    digest = hashlib.sha256(user_id.encode("utf-8")).digest()
    return PALETTE[digest[0] % len(PALETTE)]


class MockStateProvider:
    """Cycles through configured users to simulate active speakers."""

    def __init__(self, config: dict[str, Any]) -> None:
        mock = config.get("mock", {})
        users = mock.get("users", [])
        self.interval_ms = int(mock.get("speakingIntervalMs", 1600))
        self.users = [
            OverlayUser(
                id=str(user.get("id", f"user-{index + 1}")),
                display_name=str(user.get("displayName") or user.get("id") or f"User {index + 1}"),
                avatar_url=str(user.get("avatarUrl", "")),
            )
            for index, user in enumerate(users)
        ]
        if not self.users:
            self.users = [
                OverlayUser(id="player-001", display_name="Player One"),
                OverlayUser(id="player-002", display_name="Player Two"),
                OverlayUser(id="player-003", display_name="Player Three"),
            ]
        self._speaker_cycle = itertools.cycle(range(len(self.users)))
        self._last_switch = 0.0
        self._active_index = 0

    def snapshot(self) -> OverlayState:
        now = time.time()
        if (now - self._last_switch) * 1000 >= self.interval_ms:
            self._active_index = next(self._speaker_cycle)
            self._last_switch = now

        users = [
            OverlayUser(
                id=user.id,
                display_name=user.display_name,
                avatar_url=user.avatar_url,
                speaking=index == self._active_index,
                color=stable_color(user.id),
            )
            for index, user in enumerate(self.users)
        ]
        return OverlayState(users=users, updated_at=now, source="mock")


class OopzOverlayProvider:
    """Uses OOPZ's built-in overlay WebSocket as the source of truth."""

    def __init__(self, config: dict[str, Any]) -> None:
        local = config.get("oopzLocal", {})
        self._snapshot = OopzOverlaySnapshot()
        self._lock = threading.Lock()
        self._client = OopzOverlayClient(
            host=str(local.get("host", "127.0.0.1")),
            port=int(local.get("port", 10274)),
            path=str(local.get("path", "/")),
            reconnect_delay=float(local.get("reconnectDelaySeconds", 2)),
            on_message=self._handle_message,
            on_status=self._handle_status,
        )
        self._client.start()

    def snapshot(self) -> OverlayState:
        with self._lock:
            snapshot = self._snapshot
            return OverlayState(
                users=[self._to_overlay_user(member) for member in snapshot.members],
                updated_at=snapshot.updated_at,
                source="oopz-local",
                connected=snapshot.connected,
                voice=snapshot.voice,
                last_error=snapshot.last_error,
            )

    def _handle_message(self, message: dict[str, Any]) -> None:
        snapshot = parse_members_message(message)
        if snapshot is None:
            return
        with self._lock:
            self._snapshot = snapshot

    def _handle_status(self, connected: bool, error: str) -> None:
        with self._lock:
            self._snapshot.connected = connected
            self._snapshot.last_error = error
            if connected or not self._snapshot.members:
                self._snapshot.updated_at = time.time()

    def _to_overlay_user(self, member: Any) -> OverlayUser:
        user_id = member.raw_id or member.name
        return OverlayUser(
            id=user_id,
            display_name=member.name,
            avatar_url=avatar_url_from_path(member.avatar_path),
            speaking=member.talking,
            color=stable_color(user_id),
            muted=member.muted,
        )


def avatar_url_from_path(path: str) -> str:
    if not path:
        return ""
    return f"/api/avatar?path={quote(path)}"
