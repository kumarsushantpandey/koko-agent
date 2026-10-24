from __future__ import annotations
import asyncio
import json
import logging
from typing import Any
from websockets.asyncio.server import ServerConnection

logger = logging.getLogger(__name__)

class Broadcaster:
    """Manages active WebSocket client connections and provides broadcast mechanisms."""

    def __init__(self):
        self._connections: set[ServerConnection] = set()
        self._lock = asyncio.Lock()

    async def register(self, websocket: ServerConnection):
        async with self._lock:
            self._connections.add(websocket)
            logger.info("Client connected. Total clients: %d", len(self._connections))

    async def unregister(self, websocket: ServerConnection):
        async with self._lock:
            self._connections.discard(websocket)
            logger.info("Client disconnected. Total clients: %d", len(self._connections))

    @property
    def has_clients(self) -> bool:
        return len(self._connections) > 0

    async def broadcast_json(self, payload: dict[str, Any]):
        """Broadcast a JSON serializable dictionary to all connected clients."""
        if not self._connections:
            return

        message = json.dumps(payload)
        dead_connections: list[ServerConnection] = []

        async with self._lock:
            for ws in list(self._connections):
                try:
                    await ws.send(message)
                except Exception as e:
                    logger.warning("Failed to send JSON message to client: %s", e)
                    dead_connections.append(ws)

            for dead in dead_connections:
                self._connections.discard(dead)

    async def broadcast_binary(self, data: bytes):
        """Broadcast raw binary data to all connected clients."""
        if not self._connections:
            return

        dead_connections: list[ServerConnection] = []

        async with self._lock:
            for ws in list(self._connections):
                try:
                    await ws.send(data)
                except Exception as e:
                    logger.warning("Failed to send binary packet to client: %s", e)
                    dead_connections.append(ws)

            for dead in dead_connections:
                self._connections.discard(dead)

broadcaster = Broadcaster()
