# Chat Input & Real-Time Audio Streaming Specification

## 1. Overview & Objective

This specification details the architecture, data contracts, and design principles for the **interactive glassmorphic chat input bar, real-time client-to-server voice streaming, and responsive subtitle coexistence** in the Akari Watanabe AI assistant.

The system supports two complementary input modalities without disrupting the 3D avatar rendering loop:
1. **Zero-Latency Keyboard Text Input**: Multiline text input with native CSS field sizing, instant DOM response, Enter-to-send support, and GPU composite isolation over a 60 FPS WebGL canvas.
2. **Real-Time Streaming Voice Input**: Live browser microphone capture (16kHz PCM), streamed binary WebSocket packets, and single-model Faster Whisper (`tiny.en`) interim word-by-word transcription.
3. **Dynamic Spatial Coexistence**: Seamless height coordination between the floating glassmorphic chat bar and the audio-synchronized anime subtitle overlay.

---

## 2. Architecture & Data Flow

```
+-------------------------------------------------------------------------------------------------+
|                                        FRONTEND (React)                                         |
|                                                                                                 |
|   [ Text Mode ]                                                                                 |
|   User Types Text  ──> Enter Key ──> AvatarSocket.send({ type: "chat_message", text })          |
|                                                                                                 |
|   [ Voice Mode ]                                                                                |
|   User Clicks Mic  ──> AudioContext (16kHz Mono) ──> ScriptProcessorNode                        |
|                    ──> AvatarSocket.sendBinary(0x10 + Int16 PCM)                                |
|                    ──> On Stop ──> AvatarSocket.sendBinary(0x11 [VOICE_END])                   |
|                                                                                                 |
|   [ Incoming Events ]                                                                           |
|   Live Words  <── "transcription" (word-by-word append to textarea)                             |
|   Subtitles   <── "speech_segment" (rendered at bottom: 16% when raised, 8% when default)      |
+-------------------------------------------------------------------------------------------------+
                                      |                     ^
                     Binary Chunks & JSON |                     | JSON Events & Audio
                                      v                     |
+-------------------------------------------------------------------------------------------------+
|                                        BACKEND (Python)                                         |
|                                                                                                 |
|   1. websocket_server.py:                                                                       |
|      - Binary 0x10 (VOICE_CHUNK) ──> VoiceSession buffer (PCM accumulator)                      |
|      - VoiceSession interim loop ──> stream_whisper.py (tiny.en every ~0.5s)                     |
|                                  ──> Emits `transcription` { text: word, is_final: false }       |
|      - Binary 0x11 (VOICE_END)   ──> Final transcription pass                                   |
|                                                                                                 |
|   2. chat/loop.py:                                                                              |
|      - Receives { type: "chat_message", text }                                                  |
|      - Mistral LLM Stream ──> Sentence & Dialogue Chunking                                      |
|      - Emotion Feature Extraction (Happy, Sad, Angry, Surprised, Neutral)                       |
|      - Parallel TTS (Fish Audio) ──> Encodes WAV Data URI                                       |
|      - Broadcaster ──> Emits `speech_segment` events with audio + emotion                       |
+-------------------------------------------------------------------------------------------------+
```

---

## 3. Protocol & Event Schema

### 3.1 Binary Packets (Client → Server)

Binary packets avoid JSON serialization overhead for high-frequency audio data. The first byte defines the packet type:

```typescript
// Client-to-Server Binary Packet Types
const PACKET_VOICE_CHUNK = 0x10; // Followed by Little-Endian Int16 PCM samples (16kHz mono)
const PACKET_VOICE_END   = 0x11; // 1-byte packet signaling end of recording
```

```python
class BinaryPacket(IntEnum):
    AUDIO           = 1     # Server -> Client
    AUDIO_END       = 2     # Server -> Client
    AUDIO_INTERRUPT = 3     # Server -> Client
    VOICE_CHUNK     = 0x10  # Client -> Server (streamed PCM audio chunk)
    VOICE_END       = 0x11  # Client -> Server (recording concluded)
```

### 3.2 JSON Event Contracts

#### `config` (Server → Client)
Dispatched immediately upon WebSocket handshake to communicate server feature toggles:
```typescript
export interface ConfigEvent {
  type: "config";
  chat_input_enabled: boolean; // True: browser UI drives conversation; False: server mic loop
}
```

#### `chat_message` (Client → Server)
Sent when the user submits text from the input bar (via Enter key or Send button):
```typescript
export interface ChatMessageEvent {
  type: "chat_message";
  text: string; // Trimmed user text input
}
```

#### `transcription` (Server → Client)
Broadcast live during voice streaming to populate the user's text area in real-time word-by-word:
```typescript
export interface TranscriptionEvent {
  type: "transcription";
  text: string;      // Current transcribed word or chunk
  is_final: boolean; // True when recording ends and final transcription pass concludes
}
```

#### `speech_segment` (Server → Client)
Sent per dialogue unit containing synthesized audio and emotion:
```typescript
export interface SpeechSegmentEvent {
  type: "speech_segment";
  text: string;
  audio: string;        // base64 data URI (data:audio/wav;base64,...)
  is_last: boolean;     // true if this is the final segment of the turn
  segment_index: number;
  total_segments: number;
  emotion?: string;
}
```

#### `turn_end` (Server → Client)
Dispatched when the server finishes generating, queuing, and dispatching all dialogue segments for the current turn:
```typescript
export interface TurnEndEvent {
  type: "turn_end";
}
```

---

## 4. Key Knowledge & Lessons Learned

### Pitfall 1: Dual Whisper Model Memory & CPU Choking
* **What Happened**: The initial prototype loaded two Faster Whisper models concurrently: `tiny.en` for interim live streaming (~0.5s intervals) and `base.en` for the final sentence completion pass.
* **Why It Failed**: Running two Whisper instances alongside Mistral LLM streaming and Fish Audio TTS exhausted system RAM, created thread pool contention on the CPU, and produced severe audio stutter and dropped WebSocket packets.
* **Key Takeaway**: Use **exactly one lightweight model instance** (`tiny.en`, ~75MB RAM footprint, ~0.3s inference on CPU). The speed of `tiny.en` is fast enough for live streaming, and its accuracy on short conversational utterances is more than sufficient. Load the model lazily only when chat input mode is enabled, and isolate it in a dedicated service module (`server/src/asr/stream_whisper.py`).

### Pitfall 2: Backdrop-Filter Repaint Invalidation over 60 FPS WebGL Canvas
* **What Happened**: The floating input bar used `backdrop-filter: blur(14px) saturate(180%)` directly on `.chat-input-bar`, with the `<textarea>` as its direct child. Users reported noticeable typing delay and cursor lag.
* **Why It Failed**: In Chromium, when an element with `backdrop-filter` contains child text that changes or a blinking cursor, the compositor invalidates the filter bounding box. Over an active Three.js WebGL canvas rendering at 60 FPS, Chromium synchronized the GPU canvas render with the main thread and re-ran the 14px 2D Gaussian blur shader across the entire 460px container on every keystroke, introducing a 50ms–150ms frame hitch.
* **Key Takeaway**: **Isolate backdrop filters to an independent GPU composite layer**. Place the background blur on a pseudo-element (`.chat-input-bar::before`) with:
  ```css
  .chat-input-bar {
    position: relative;
    isolation: isolate;
    contain: layout;
    transform: translateZ(0);
  }
  .chat-input-bar::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    backdrop-filter: blur(14px) saturate(180%);
    -webkit-backdrop-filter: blur(14px) saturate(180%);
    z-index: -1;
    pointer-events: none;
    transform: translateZ(0);
    will-change: transform;
  }
  ```
  The text layer (`.chat-input-field`) sits in front at `z-index: 1`. Characters render into their own layer without invalidating the blurred background.

### Pitfall 3: Forced Synchronous Layout / Layout Thrashing on Keystroke
* **What Happened**: An auto-resizing script measured `el.scrollHeight` and `el.clientHeight` inside the `input` event handler to adjust textarea height.
* **Why It Failed**: Querying `scrollHeight` or `clientHeight` during a keystroke event is a classic **forced synchronous layout**. The browser engine must halt JavaScript execution, flush all pending style and geometry calculations for the entire document, and recalculate box metrics.
* **Key Takeaway**:
  1. Utilize native CSS `field-sizing: content` (Chromium 123+) to let the browser engine handle height adjustments natively in C++ with 0ms JS overhead.
  2. For fallback browsers, wrap measurement and height modification inside `requestAnimationFrame()`. This ensures typed characters render to the screen immediately before layout recalculation occurs.

### Pitfall 4: Window Event Leaking to 3D Canvas Listeners
* **What Happened**: When typing spaces, arrow keys, or letters into the input box, the 3D scene camera sometimes shifted or jumped, and keyboard shortcuts registered on background debug tools (Leva).
* **Why It Failed**: Standard React `e.stopPropagation()` only halts synthetic event bubbling within React's virtual root container. Native DOM events continue to bubble to `window` and `document`, where Three.js `OrbitControls` and global key listeners reside.
* **Key Takeaway**: In `onKeyDown` and `onKeyUp`, explicitly invoke both:
  ```tsx
  e.stopPropagation();
  e.nativeEvent.stopImmediatePropagation();
  ```
  This guarantees that keystrokes remain strictly contained within the input element.

### Pitfall 5: Subtitle and Floating Chat Bar Spatial Collision
* **What Happened**: Subtitles were hardcoded to `bottom: "8%"`. When the floating chat bar was displayed at the bottom center of the screen, the subtitles directly collided with and obscured the input bar.
* **Why It Failed**: Fixed viewport positioning fails when UI elements dynamically mount based on server configuration flags.
* **Key Takeaway**: Make subtitle positioning reactive:
  - Add an optional `raised?: boolean` prop to [`SubtitleOverlay`](/client/src/components/SubtitleOverlay.tsx).
  - When `raised` is `true`: position at `bottom: "16%"` (safely above the floating chat bar with ample breathing room).
  - When `raised` is `false`: position at default `bottom: "8%"`.
  - Add CSS transition (`transition: opacity 300ms ease, bottom 0.25s ease`) for smooth elevation animations when toggling states.

### Pitfall 6: Server Mic Loop Conflict
* **What Happened**: Running `run_voice_loop()` on the server while the browser UI was also capturing microphone audio created duplicate listening loops and potential acoustic feedback.
* **Key Takeaway**: Use the `ENABLE_CHAT_INPUT` configuration toggle in [`server/src/config.py`](/server/src/config.py). When enabled, [`server/src/runtime.py`](/server/src/runtime.py) bypasses the local microphone loop and keeps the server alive via `await asyncio.Event().wait()`, letting incoming WebSocket frames drive dialogue.

---

## 5. Detailed Component Specifications

### 5.1 Frontend: `ChatInput.tsx` & `ChatInput.css`
- **Location**: [`client/src/components/ChatInput.tsx`](/client/src/components/ChatInput.tsx) and [`client/src/components/ChatInput.css`](/client/src/components/ChatInput.css)
- **Audio Capture**:
  - Uses `navigator.mediaDevices.getUserMedia` with `echoCancellation`, `noiseSuppression`, and target sample rate 16000 Hz.
  - ScriptProcessor downsamples/converts Float32 to Little-Endian Int16 PCM.
  - Streams binary packets (`0x10 + pcm_data`) via `avatarSocket.sendBinary()`.
  - On stop, sends 1-byte packet `0x11` and cleanly closes the `AudioContext` and media stream tracks.
- **Text & Keyboard Handling**:
  - Uncontrolled `<textarea>` with `ref` for instant native responsiveness.
  - `handleKeyDown`: Enter key without Shift submits via `handleSend()`; Shift+Enter creates a newline.
  - Direct DOM button property mutation (`sendBtnRef.current.disabled = !hasText`) for instantaneous visual feedback without waiting for React re-render passes.
  - **Dynamic Stop Response Button (`IconPlayerStopFilled`)**:
    - When `isResponding` is true (AI generating or speaking response), the action button switches from the dark up-arrow send button to a vibrant royal blue circle (`#2563eb`) displaying a white square (`IconPlayerStopFilled`).
    - The stop button remains clickable (`disabled = false`).
    - Clicking Stop triggers `handleStop()`, which invokes `speechQueue.interrupt()`, dispatches `{ type: "interrupt" }`, clears queued segments and audio playback, and resets the button state to send mode.

### 5.2 Frontend: `SubtitleOverlay.tsx`
- **Location**: [`client/src/components/SubtitleOverlay.tsx`](/client/src/components/SubtitleOverlay.tsx)
- **Props**:
  ```typescript
  interface SubtitleOverlayProps {
    raised?: boolean;
  }
  ```
- **Dynamic Styling**:
  ```tsx
  style={{
    ...styles.container,
    bottom: raised ? "16%" : "8%",
    opacity,
    transition: `opacity ${FADEOUT_MS}ms ease, bottom 0.25s ease`,
  }}
  ```

### 5.3 Backend: Streaming Whisper (`stream_whisper.py`)
- **Location**: [`server/src/asr/stream_whisper.py`](/server/src/asr/stream_whisper.py)
- **Model**: `tiny.en` loaded on CPU with `int8` quantization (~75MB RAM).
- **Interim Transcribe (`transcribe_stream_interim`)**:
  - VAD filter with `min_silence_duration_ms=250`.
  - Greedy decoding (`beam_size=1`, `temperature=0`, `condition_on_previous_text=False`).
  - RMS silence threshold check to skip processing dead air.
- **Final Transcribe (`transcribe_stream_final`)**:
  - Uses the identical model instance with hallucination silence thresholds and repetition penalties.

### 5.4 Backend: WebSocket Server (`websocket_server.py`)
- **Location**: [`server/src/bridge/websocket_server.py`](/server/src/bridge/websocket_server.py)
- **`VoiceSession` Class**:
  - Manages per-client audio chunk accumulation.
  - Runs background `_interim_worker` every `0.5s` on accumulated audio (> 0.4s).
  - Tracks `_sent_words_count` and emits only novel words (`is_final: false`).
  - Runs `finalize()` on `VOICE_END` packet, flushing remaining words and sending `{ is_final: true }`.
- **Interrupt / Abort Dispatching**:
  - Intercepts binary packet `0x03` (`BinaryPacket.AUDIO_INTERRUPT`) and JSON packets `{ type: "interrupt" }` / `{ type: "stop" }`.
  - Invokes `await stop_chat_stream(emit_speech_end=True)` when user explicitly halts the conversation.
  - When starting a new chat turn via `_handle_chat_message()`, invokes `await stop_chat_stream(emit_speech_end=False)` so that any previous generation task is safely cancelled *without* broadcasting a premature `speech_end` to the browser.

### 5.5 Backend: Chat Loop (`chat/loop.py`)
- **Location**: [`server/src/chat/loop.py`](/server/src/chat/loop.py)
- **Immediate Stream Abort (`stop_chat_stream(emit_speech_end=True)`)**:
  - Sets a `threading.Event()` cancel flag that breaks the Mistral LLM token generator loop immediately.
  - Cancels the active `asyncio.Task` and flushes any pending dialogue units in the `unit_queue`.
  - Only dispatches `speech_end()` when `emit_speech_end=True` (explicit stop request). Suppresses `speech_end` when replacing an active task with a new user query.
- **Thinking Event Dispatch (`thinking_start`)**:
  - Broadcasts `await thinking_start()` immediately when a chat message begins processing.
- **Lookahead Final Segment Flagging (`is_last`)**:
  - Employs a 1-item lookahead buffer (`pending`) to evaluate whether each dialogue unit is the final one (`unit is None`).
  - Preceding units are broadcast with `is_last=False`; the final unit is broadcast with `is_last=True`.
- **Turn Conclusion Broadcast (`turn_end`)**:
  - Emits `await turn_end()` when LLM token generation, unit queuing, and TTS dispatching are completely finished for the turn.
- **Pipeline**:
  1. Emits `transcript` event with user query.
  2. Emits `thinking_start` event to indicate generation has begun.
  3. Evaluates exit phrases.
  4. Streams tokens from `stream_chat(user_text, _history)` (abortable via cancel flag).
  5. Parses bracketed emotion tags via `EmotionFeatureManager`.
  6. Chunks tokens into discrete 1–2 line dialogue units (max 16 words or punctuation boundaries).
  7. Synthesizes WAV audio asynchronously via Fish Audio TTS per unit.
  8. Dispatches synchronized `speech_segment` events with base64 audio and emotion tags.
  9. Dispatches `turn_end()` to notify client that all segments have been transmitted.
  10. Maintains clean conversation history across turns.

---

## 6. Response & Playing State Lifecycle Contract

### 6.1 Requirements
1. **Instant Feedback**: The stop icon (`IconPlayerStopFilled` in royal blue `#3b82f6` circle) must appear immediately upon Send click or Enter keypress.
2. **Turn Continuity**: The stop icon must persist without flickering across:
   - LLM thinking / token generation latency.
   - Fish Audio TTS synthesis latency.
   - Network transmission latency.
   - Hardware audio playback across multiple sentence segments (segment 0, segment 1, segment 2...).
3. **No Premature Deactivation**:
   - Starting a new chat message must NOT broadcast `speech_end`.
   - Inter-segment gaps (200–500ms while segment $N+1$ is being synthesized) must NOT cause `speech_end` to fire or revert the button to the Send icon.
   - Stray server `speech_end` events must be ignored while `SpeechQueue.active` is true.
4. **Physical Audio Completion**: The button reverts to the Send icon (`IconArrowUp`) only after physical hardware audio playback of the final segment finishes on the browser's `AudioContext`, or when the user explicitly clicks the Stop button.

### 6.2 Implementation Architecture
- **`SpeechQueue.startTurn()`**:
  - Invoked synchronously in `ChatInput.handleSend()` prior to WebSocket message transmission.
  - Sets `isTurnActive = true` and arms a 60s safety watchdog.
  - Keeps `ChatInput.isResponding = true`.
- **`SpeechQueue.enqueue(segment)`**:
  - Queues segment audio and begins playback if idle.
  - Resets turn safety watchdogs.
- **Inter-Segment Continuity**:
  - When segment audio finishes on `AudioPlayer`:
    - If `queue.length > 0`: immediately plays next segment.
    - If `segment.is_last || turnEndedByServer || !isTurnActive`: calls `finishTurn()` -> emits `speech_end` -> reverts button.
    - Else: retains `isTurnActive = true`, arms a 10s watchdog, and waits for next segment without emitting `speech_end`.
- **`SpeechQueue.endTurn()`**:
  - Received from server `{ type: "turn_end" }`.
  - Marks `turnEndedByServer = true`. If all audio segments have already finished playing, concludes the turn; otherwise allows the final segment to finish hardware playback naturally.
- **`ChatInput` Event Binding**:
  - Subscribes to `speechQueue.onAllSegmentsEnd()` as the primary trigger to set `isResponding = false`.
  - Subscribes to `thinking_start` and `speech_start` to maintain `isResponding = true`.
  - In `avatarEvents.subscribe("speech_end")`, ignores the event if `speechQueue.active` is true, ensuring no rogue server event can remove the stop button while a turn is active.
- **`SpeechQueue.interrupt()`**:
  - Stops hardware audio, clears queue, sets `isTurnActive = false`, and emits `speech_end` immediately.
