# Phase 03: Full-Duplex WebSocket Bridge & Streaming Whisper ASR
**Task**: Build the asynchronous WebSocket server supporting high-throughput binary audio streaming, typed event broadcasting, and real-time Whisper speech recognition.  
**Related Phase**: `./docs/implementation/02_3d_vrm_engine_and_character_controllers.md`  
**Referenced Skill**: `./.agents/skills/websocket-streaming-companion-bridge/SKILL.md`

---

## 1. Architectural Goal

Provide a robust, full-duplex communication channel between browser and Python server over `ws://127.0.0.1:8765`:
1. **Binary Framing**: Ingestion of 16kHz Int16 PCM audio from client mic (`0x10`) and instantaneous stream cancellation (`0x03`).
2. **Streaming Whisper ASR (`chat_whisper.py`)**: Real-time interim (~0.5s) and final speech transcription with single-model memory efficiency.
3. **Broadcasting Bus (`broadcaster.py`)**: Fan-out of typed JSON events (`config`, `transcript`, `speech_segment`, `thinking_start`, `turn_end`).
4. **Client Socket Bridge (`AvatarSocket.ts`)**: Auto-reconnecting client transport with typed subscription event bus.

---

## 2. Agent Skill & Implementation Prompt

When delegating this phase to an AI agent, use the following prompt:

```markdown
Build the full-duplex WebSocket bridge and streaming ASR pipeline:
1. In `./server/src/bridge/protocol.py`, define `BinaryPacket`:
   - AUDIO_CHUNK = 0x01, AUDIO_END = 0x02, AUDIO_INTERRUPT = 0x03, VOICE_CHUNK = 0x10, VOICE_END = 0x11.
2. In `./server/src/asr/chat_whisper.py`, load a single `faster-whisper` model (`small.en`, int8 on CPU) for live streaming transcription with VAD.
3. In `./server/src/bridge/websocket_server.py`, multiplex binary audio frames and JSON control messages (`chat_message`, `set_mode`, `set_llm_provider`, `set_tool_calling`, `get_config`).
4. In `./client/src/networking/AvatarSocket.ts`, implement automatic reconnection, binary frame demuxing, and typed event dispatching on `EventBus.ts`.
5. Implement clean interruption: user clicking Stop sends `0x03` or `{ type: "interrupt" }` to stop active LLM streaming and TTS synthesis immediately.
```

---

## 3. Core Implementation

### 3.1 Binary Protocol Constants (`./server/src/bridge/protocol.py`)

```python
class BinaryPacket:
    AUDIO_CHUNK = 0x01      # Server -> Client: Synthesized audio bytes
    AUDIO_END = 0x02        # Server -> Client: Audio stream completed
    AUDIO_INTERRUPT = 0x03  # Bidirectional: Immediately cancel speech
    VOICE_CHUNK = 0x10      # Client -> Server: 16kHz Int16 PCM audio chunk
    VOICE_END = 0x11        # Client -> Server: Recording stopped
```

### 3.2 Streaming Whisper Service (`./server/src/asr/chat_whisper.py`)

```python
import numpy as np
from faster_whisper import WhisperModel

STREAMING_MODEL_NAME = "small.en"
_model: WhisperModel | None = None

def get_model() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel(
            STREAMING_MODEL_NAME,
            device="cpu",
            compute_type="int8",
        )
    return _model

def transcribe_stream_interim(audio: np.ndarray) -> str:
    """Interim transcription during active speech (runs every ~0.5s)."""
    if audio.size == 0 or float(np.sqrt(np.mean(audio**2))) < 0.003:
        return ""

    model = get_model()
    segments, _ = model.transcribe(
        audio,
        language="en",
        beam_size=1,
        temperature=0,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=250),
        without_timestamps=True,
    )
    return " ".join(s.text.strip() for s in segments).strip()

def transcribe_stream_final(audio: np.ndarray) -> str:
    """Final high-accuracy transcription when recording stops."""
    if audio.size == 0 or float(np.sqrt(np.mean(audio**2))) < 0.003:
        return ""

    model = get_model()
    segments, _ = model.transcribe(
        audio,
        language="en",
        beam_size=1,
        temperature=0,
        vad_filter=True,
        without_timestamps=True,
    )
    return " ".join(s.text.strip() for s in segments).strip()
```

### 3.3 WebSocket Dispatcher (`./server/src/bridge/websocket_server.py`)

```python
async def client_handler(websocket: ServerConnection):
    await broadcaster.register(websocket)
    await websocket.send(json.dumps(_build_config_dict()))

    try:
        async for message in websocket:
            # Binary path: mic audio chunks & interrupts
            if isinstance(message, bytes):
                packet_type = message[0]
                if packet_type == BinaryPacket.VOICE_CHUNK:
                    await _handle_voice_chunk(websocket, message[1:])
                elif packet_type == BinaryPacket.VOICE_END:
                    await _handle_voice_end(websocket)
                elif packet_type == BinaryPacket.AUDIO_INTERRUPT:
                    await stop_chat_stream()
                continue

            # JSON path: control messages
            data = json.loads(message)
            msg_type = data.get("type")
            if msg_type == "chat_message":
                await _handle_chat_message(data)
            elif msg_type == "set_llm_provider":
                set_active_provider(data.get("provider"), data.get("model"))
            elif msg_type == "set_tool_calling":
                _tool_calling_enabled = bool(data.get("enabled"))
            elif msg_type == "interrupt":
                await stop_chat_stream()
    finally:
        await broadcaster.unregister(websocket)
```

---

## 4. Verification & Testing Instructions

### 4.1 Automated WebSocket Ping-Pong Test
Create a scratch script in `./server/scratch_test_ws.py`:
```python
import asyncio
import json
import websockets

async def test_ws():
    uri = "ws://127.0.0.1:8765"
    async with websockets.connect(uri) as ws:
        # Step 1: Wait for config event
        raw = await ws.recv()
        config = json.loads(raw)
        assert config["type"] == "config"
        print("✓ Received initial config event:", config["llm_provider"])

        # Step 2: Send get_config request
        await ws.send(json.dumps({"type": "get_config"}))
        resp = await ws.recv()
        resp_data = json.loads(resp)
        assert resp_data["type"] == "config"
        print("✓ Successfully received get_config response")

asyncio.run(test_ws())
```

Run test:
```bash
cd server
uv run python scratch_test_ws.py
```
**Expected Output**:
```
✓ Received initial config event: mistral
✓ Successfully received get_config response
```

### 4.2 Browser Voice Streaming Test
1. In `./client/`, navigate to `http://localhost:5173/?screen=chat`.
2. Click and hold the microphone button in the input bar.
3. Speak: *"Hello Akari"*.
4. **Verify**:
   - The interim indicator illuminates in purple showing real-time word transcription.
   - Releasing the button triggers final Whisper transcription and sends the message cleanly.
