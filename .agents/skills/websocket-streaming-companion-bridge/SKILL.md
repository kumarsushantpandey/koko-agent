---
name: websocket-streaming-companion-bridge
description: Full-duplex WebSocket architecture uniting streaming Whisper ASR (int16 PCM), parallel sentence-level TTS synthesis, binary audio protocols, and summary buffer memory compaction.
---

# WebSocket Streaming Companion Bridge Skill

Use this skill when building a full-duplex communication bridge between a web browser UI and a real-time conversational AI companion backend.

---

## 1. Protocol Architecture: Binary + JSON Multiplexing

Use a single persistent WebSocket connection (`ws://127.0.0.1:8765`) handling both high-throughput binary audio frames and typed JSON events.

### Binary Header Protocol
Inspect the first byte (`message[0]`) to route binary packets without JSON serialization overhead:
- `0x01` (`AUDIO_CHUNK`): Raw audio bytes for gapless playback.
- `0x02` (`AUDIO_END`): Signals audio stream completion.
- `0x03` (`AUDIO_INTERRUPT`): User clicked Stop; cancel generation immediately.
- `0x10` (`VOICE_CHUNK`): Streamed 16kHz Int16 PCM audio from client mic.
- `0x11` (`VOICE_END`): User stopped speaking; trigger final ASR transcription pass.

---

## 2. Low-Latency Streaming Whisper ASR

Avoid loading multiple Whisper models concurrently to prevent CPU/RAM saturation:

```python
from faster_whisper import WhisperModel
import numpy as np

# Single shared model instance for live streaming
model = WhisperModel("small.en", device="cpu", compute_type="int8")

def transcribe_interim(audio_chunk: np.ndarray) -> str:
    # Quick interim pass every ~500ms
    segments, _ = model.transcribe(
        audio_chunk,
        beam_size=1,
        temperature=0,
        vad_filter=True,
        without_timestamps=True,
    )
    return " ".join(s.text.strip() for s in segments)
```

---

## 3. Parallel Sentence-Level TTS Pipeline

Monolithic TTS synthesis delays voice output until the LLM finishes generating the entire response. Use the **Sentence-Level Streaming Pipeline**:

```
[ LLM Token Stream ]
        │
        ▼
[ Sentence Accumulator ] ──► Chunks at punctuation boundaries: [. ! ? \n]
        │
        ▼
[ Parallel TTS Worker ] ──► Async audio synthesis per sentence chunk
        │
        ▼
[ WebSocket Dispatch ]  ──► Dispatches speech_segment with audio & emotion
```

### The Sentence Chunking Pattern
- Emit a sentence chunk when reaching a terminal punctuation mark (`.`, `!`, `?`, `\n`) with at least 3 words, or when word count reaches 16 words.
- This produces the first spoken audio within 400ms–800ms while the LLM continues generating subsequent sentences.

---

## 4. Summary Buffer Memory Compaction

Prevent unbounded memory growth and token bloat during long sessions:

```python
COMPACTION_THRESHOLD_MESSAGES = 16  # ~8 conversational turns
KEEP_RECENT_MESSAGES = 6            # Retain recent 3 turns untouched

def compact_conversation(history: list, llm_client) -> list:
    if len(history) < COMPACTION_THRESHOLD_MESSAGES:
        return history

    older_turns = history[:-KEEP_RECENT_MESSAGES]
    recent_turns = history[-KEEP_RECENT_MESSAGES:]

    summary = llm_client.generate_summary(older_turns)

    return [
        {"role": "user", "content": f"[Context from earlier conversation:\n{summary}\n(Background memory)]"},
        {"role": "assistant", "content": "[Understood, I remember everything we talked about.]"},
    ] + recent_turns
```

---

## 5. Clean Stream Interruption (Stop Generation)

When the user types a new message or clicks Stop while Akari is still generating or speaking:
1. Signal a `threading.Event()` (`cancel_event.set()`) to break the active LLM generator loop.
2. Cancel the background `asyncio.Task` handling TTS synthesis and audio dispatch.
3. Emit `speech_end` event to reset the 3D avatar's facial expressions to `Neutral`.
