from __future__ import annotations
import asyncio
import logging
import sys

# Windows console UTF-8 fix to prevent UnicodeEncodeError with emojis
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("koko")

BANNER = r"""
  _  __      _            _    ___ 
 | |/ /     | |          / \  |_ _|
 | ' /  ___ | | _____   / _ \  | | 
 | . \ / _ \| |/ / _ \ / ___ \ | | 
 |_|\_\\___/|_|\_\___//_/   \_|___|
   Multimodal 3D VRM Anime Assistant
"""

async def main():
    print(BANNER)
    from src.bridge.websocket_server import start_websocket_server
    await start_websocket_server()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Koko AI server shutdown cleanly.")
