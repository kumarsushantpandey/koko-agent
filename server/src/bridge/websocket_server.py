"""Full-duplex WebSocket server bridge connecting browser frontend to Python agent backend."""

from __future__ import annotations
import asyncio
import json
import logging
from typing import Any
import numpy as np
from websockets.asyncio.server import ServerConnection, serve

from src import config
from src.bridge.broadcaster import broadcaster
from src.bridge.protocol import BinaryPacket
from src.asr import transcribe_stream_interim, transcribe_stream_final
from src.llm import (
    set_active_provider,
    set_runtime_api_key,
    set_runtime_llamacpp_url,
    get_active_provider_info,
)
from src.tools.registry import tool_registry
from src.chat import process_chat_message, stop_chat_stream, clear_conversation_history

logger = logging.getLogger(__name__)

_tool_calling_enabled: bool = config.TOOL_CALLING_ENABLED

def build_config_dict() -> dict[str, Any]:
    provider_info = get_active_provider_info()
    return {
        "type": "config",
        "assistant_name": "Koko AI",
        "chat_input_enabled": config.ENABLE_CHAT_INPUT,
        "llm_provider": provider_info["provider"],
        "llm_model": provider_info["model"],
        "available_llm_providers": provider_info["available_providers"],
        "tool_calling_enabled": _tool_calling_enabled,
        "tool_calling_supported": True,
        "vision_supported": True,
        "max_tool_calls": config.MAX_TOOL_CALL_ROUNDS,
        "available_tools": tool_registry.get_tools_summary(),
        "api_keys_configured": {
            "mistral": bool(config.MISTRAL_API_KEY),
            "llama_cpp": True,
            "tavily": bool(config.TAVILY_API_KEY),
            "fish": bool(config.FISH_AUDIO_API_KEY),
        },
    }

async def client_handler(websocket: ServerConnection):
    """Handle lifecycle for a single persistent WebSocket client connection."""
    global _tool_calling_enabled
    await broadcaster.register(websocket)
    # Send initial configuration immediately on connect
    await websocket.send(json.dumps(build_config_dict()))

    # Per-connection mic PCM audio accumulator
    pcm_buffer: bytearray = bytearray()
    last_interim_time = 0.0

    try:
        async for message in websocket:
            # 1. Binary Packet Path (Microphone streaming & interrupts)
            if isinstance(message, bytes):
                if not message:
                    continue
                packet_type = message[0]
                payload = message[1:]

                if packet_type == BinaryPacket.VOICE_CHUNK:
                    pcm_buffer.extend(payload)
                    loop = asyncio.get_running_loop()
                    now = loop.time()

                    # Interim transcription pass every ~400ms
                    if now - last_interim_time >= 0.4 and len(pcm_buffer) >= 6400: # ~200ms of 16kHz Int16
                        last_interim_time = now
                        audio_int16 = np.frombuffer(bytes(pcm_buffer), dtype=np.int16)
                        audio_f32 = audio_int16.astype(np.float32) / 32768.0
                        interim_text = await loop.run_in_executor(None, transcribe_stream_interim, audio_f32)
                        if interim_text:
                            await broadcaster.broadcast_json({
                                "type": "transcript",
                                "text": interim_text,
                                "is_final": False,
                            })

                elif packet_type == BinaryPacket.VOICE_END:
                    if pcm_buffer:
                        loop = asyncio.get_running_loop()
                        audio_int16 = np.frombuffer(bytes(pcm_buffer), dtype=np.int16)
                        audio_f32 = audio_int16.astype(np.float32) / 32768.0
                        final_text = await loop.run_in_executor(None, transcribe_stream_final, audio_f32)
                        pcm_buffer.clear()

                        if final_text:
                            await broadcaster.broadcast_json({
                                "type": "transcript",
                                "text": final_text,
                                "is_final": True,
                            })
                            # Trigger chat processing loop
                            asyncio.create_task(process_chat_message(
                                text=final_text,
                                tools_enabled=_tool_calling_enabled,
                            ))

                elif packet_type == BinaryPacket.AUDIO_INTERRUPT:
                    await stop_chat_stream()

                continue

            # 2. JSON Message Path (Typed client commands)
            try:
                data = json.loads(message)
            except Exception as e:
                logger.warning("Failed to parse client JSON message: %s", e)
                continue

            msg_type = data.get("type")

            if msg_type == "chat_message":
                text = data.get("text", "").strip()
                image = data.get("image")
                provider = data.get("provider")
                model = data.get("model")
                tools_enabled = data.get("tools_enabled", _tool_calling_enabled)
                timezone = data.get("timezone")

                if text or image:
                    asyncio.create_task(process_chat_message(
                        text=text,
                        image=image,
                        provider=provider,
                        model=model,
                        tools_enabled=tools_enabled,
                        timezone=timezone,
                    ))

            elif msg_type == "interrupt":
                await stop_chat_stream()

            elif msg_type == "set_llm_provider":
                provider = data.get("provider", "mistral")
                model = data.get("model")
                set_active_provider(provider, model)
                await broadcaster.broadcast_json(build_config_dict())

            elif msg_type == "set_tool_calling":
                _tool_calling_enabled = bool(data.get("enabled", True))
                await broadcaster.broadcast_json(build_config_dict())

            elif msg_type == "set_api_key":
                prov = data.get("provider", "")
                key = data.get("api_key", "")
                url = data.get("base_url", "")
                if prov:
                    if key:
                        set_runtime_api_key(prov, key)
                    if url and prov == "llama_cpp":
                        set_runtime_llamacpp_url(url)
                await broadcaster.broadcast_json(build_config_dict())

            elif msg_type == "get_config":
                await websocket.send(json.dumps(build_config_dict()))

            elif msg_type == "clear_history":
                clear_conversation_history()
                await websocket.send(json.dumps({"type": "history_cleared"}))

    except Exception as e:
        logger.info("Client handler exception: %s", e)
    finally:
        await broadcaster.unregister(websocket)

async def start_websocket_server():
    """Start the WebSocket server on HOST:PORT."""
    logger.info("Starting Koko AI WebSocket server on ws://%s:%d ...", config.HOST, config.PORT)
    server = await serve(
        client_handler,
        config.HOST,
        config.PORT,
        max_size=32 * 1024 * 1024, # 32 MB max frame for base64 images
    )
    logger.info("Koko AI WebSocket server active on ws://%s:%d", config.HOST, config.PORT)
    await server.wait_closed()
