"""Read-only probe for OOPZ local overlay communication.

The OOPZ desktop client appears to expose a localhost WebSocket endpoint for
its overlay process. This script connects as an extra client and prints any
frames it receives. It does not inject into OOPZ, modify files, or send
application commands.
"""

from __future__ import annotations

import argparse
import json
import socket
import time

from oopz_overlay import BufferedSocket, parse_members_message, read_ws_frame, websocket_handshake


def main() -> None:
    parser = argparse.ArgumentParser(description="Probe OOPZ local WebSocket frames.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=10274)
    parser.add_argument("--path", default="/")
    parser.add_argument("--seconds", type=float, default=10)
    args = parser.parse_args()

    sock, leftover = websocket_handshake(args.host, args.port, args.path)
    sock.settimeout(1)
    reader = BufferedSocket(sock, leftover)
    deadline = time.time() + args.seconds
    frame_count = 0

    print(f"Listening for {args.seconds:g}s. Speak in OOPZ now if you want to trigger events.")
    try:
        while time.time() < deadline:
            try:
                opcode, payload = read_ws_frame(reader)
            except socket.timeout:
                print(".", end="", flush=True)
                continue
            except EOFError as exc:
                print(f"\n{exc}")
                break

            frame_count += 1
            if opcode == 1:
                text = payload.decode("utf-8", errors="replace")
                print(f"\nTEXT frame #{frame_count} ({len(payload)} bytes):")
                print(text[:4000])
                try:
                    snapshot = parse_members_message(json.loads(text))
                except json.JSONDecodeError:
                    snapshot = None
                if snapshot:
                    print(f"parsed: voice={snapshot.voice} members={len(snapshot.members)}")
                    for member in snapshot.members:
                        print(
                            f"- {member.name}: talking={member.talking} "
                            f"muted={member.muted} avatar={member.avatar_path}"
                        )
            else:
                print(f"\nFRAME #{frame_count}: opcode={opcode} length={len(payload)}")
                print(repr(payload[:160]))
    finally:
        sock.close()

    print(f"\nframes: {frame_count}")


if __name__ == "__main__":
    main()
