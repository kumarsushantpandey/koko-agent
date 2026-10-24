# Audio-Synchronized Subtitle & Speech Segment Specification

## 1. Overview & Objective

This specification details the architecture, data contracts, and design principles for the real-time audio-synchronized subtitle system in the Akari Watanabe AI assistant.

The primary objective is to present dialogue on screen in **strictly 2-line visual units** that stay on screen for the exact duration of the spoken audio for those two lines, highlight words sequentially in sync with speech, and transition to the next two lines precisely when the corresponding audio finishes playing.

---

## 2. Architecture & Data Flow

```
+-------------------------------------------------------------------------+
|                              BACKEND (Python)                           |
|                                                                         |
|  1. ASR (Whisper) -> User Voice Captured                                |
|  2. LLM (Mistral) -> Stream response tokens                             |
|  3. Dialogue Segmenter -> Splits reply into 1-2 line sentence units     |
|  4. Parallel TTS (Fish Audio) -> Synthesizes WAV audio for each segment  |
|  5. Broadcaster -> Dispatches `speech_segment` events over WebSocket    |
+-------------------------------------------------------------------------+
                                    |
                         WebSocket JSON Events
                                    |
                                    v
+-------------------------------------------------------------------------+
|                             FRONTEND (React)                            |
|                                                                         |
|  1. AvatarSocket -> Receives `speech_segment` events                    |
|  2. SpeechQueue -> Enqueues segments & controls sequential playback     |
|  3. AudioPlayer -> Plays audio via HTMLAudioElement routed through       |
|                    Web Audio API (GainNode -> AnalyserNode)             |
|  4. LipSyncController -> Reads AnalyserNode live FFT for VRM lip-sync    |
|  5. SubtitleOverlay -> Displays 2 lines, highlights word-by-word        |
|                        synced to `audio.currentTime / audio.duration`,  |
|                        and flips strictly on `audio.onended`            |
+-------------------------------------------------------------------------+
```

---

## 3. Protocol & Event Schema

### Event: `speech_segment`
Sent by the backend over the main WebSocket connection (`ws://127.0.0.1:8765`) for each 2-line dialogue segment.

```typescript
export interface SpeechSegmentEvent {
  type: "speech_segment";
  text: string;           // Dialogue text for this segment (max 2 visual lines, ~14-18 words)
  audio: string;          // Base64 Data URI: "data:audio/wav;base64,..."
  is_last: boolean;       // True if this is the final segment of the assistant's turn
  segment_index: number;  // 0-indexed segment order
  total_segments: number; // Total count of segments in this turn
  emotion?: string;       // Active emotion preset ("Happy", "Sad", "Angry", "Surprised", "Relaxed", "Neutral")
}
```

> [!NOTE]
> For the complete specification on facial expression synchronization and multi-emotion shifting across segments, see [spec/emotion_sync.md](./spec/emotion_sync.md).


---

## 4. Key Knowledge & Lessons Learned

### Pitfall 1: Network Burst vs. Audio Playback Time
* **What Happened**: Originally, subtitles estimated progress by counting raw audio bytes as they arrived over the WebSocket (`totalBytes / 88200`).
* **Why It Failed**: Network transmission runs at network speed (often 5x–15x faster than real-time audio). Within 500ms, 6 seconds of audio packets arrived, causing the subtitle highlight to race to the end almost instantly while the avatar was still speaking her very first word.
* **Key Takeaway**: Network arrival time has zero correlation with speaker playback time. Subtitle progress must always be driven by hardware sound playback (`AudioContext.currentTime` or `HTMLAudioElement.currentTime`).

### Pitfall 2: Timer-Based Word Animation & Durations
* **What Happened**: Attempting to predict word durations mathematically (e.g. `WORDS_PER_SECOND = 3.2` or complex syllable/pause weighting) across an entire monolithic audio stream.
* **Why It Failed**: As the user observed: *"its just changing the time the animation ends, not in sync"*. A fixed timer will inevitably drift because speech rhythm varies drastically depending on sentence type, pauses, and intonation. Furthermore, if the animation ends before or after the audio, lines either vanish while the speaker is talking or hang awkwardly after speech ends.
* **Key Takeaway**: Do not use artificial animation timers to control dialogue transitions. Audio segments must have hard, physical boundaries.

### Pitfall 3: Monolithic Audio Streaming vs. Dialogue Boundaries
* **What Happened**: Streaming the entire LLM reply as a single continuous raw PCM audio stream prevented the frontend from knowing which samples corresponded to which visual sentence.
* **Why It Failed**: The frontend had no marker indicating when line 1 & 2 ended and when line 3 began. Any attempt to split the visual text on the client while receiving one continuous stream resulted in either premature page flips or cutoffs.
* **Key Takeaway**: Follow the **LocalAIVtuber2 pattern**: Segment dialogue on the server into sentence units. Generate discrete audio files per segment. The transition from one 2-line subtitle to the next must be triggered directly by the physical completion of the previous audio segment (`audio.onended`).

### Pitfall 4: Sample Rate Mismatch in AudioWorklet
* **What Happened**: Hardcoding 44100 Hz in an `AudioWorkletProcessor` when Windows audio hardware frequently initializes at 48000 Hz.
* **Key Takeaway**: Using standard `HTMLAudioElement` with `data:audio/wav;base64,...` delegates audio format decoding and hardware resampling to the browser engine, eliminating sample-rate bugs and underrun clicks.

### Pitfall 5: Barge-in & Interruption Cleanup
* **What Happened**: When a user interrupts while the assistant is mid-speech, background audio chunks and queued segments continued to play out, causing desynchronized subtitles from previous turns to overlap new queries.
* **Why It Happened**: Queues without a centralized interrupt switch will drain all pre-buffered segments regardless of new user input.
* **Key Takeaway**: Implement a clean `speechQueue.interrupt()` method triggered on both `interrupted` events and `user_transcript` events. This stops the active `HTMLAudioElement` immediately, detaches completion listeners, wipes queued segments, and resets subtitle states to idle.

### Pitfall 6: Web Audio Graph Integration with MediaElement
* **What Happened**: Direct `audio.play()` does not route through Web Audio nodes by default, which broke the VRM model's lip-sync analyzer.
* **Key Takeaway**: Bind the `HTMLAudioElement` once to the `AudioContext` via `context.createMediaElementSource(audioElement)`. Route that source into `gainNode -> analyserNode -> destination`. This ensures the 3D VRM character's real-time FFT lip-sync continues to react directly to the audio element's hardware playback without double-output or desync.

---

## 5. Detailed Component Specifications

### 5.1 Backend: Dialogue Segmenter & Parallel TTS

#### Dialogue Unit Splitting (`server/src/voice/loop.py`)
Splits the assistant's clean text response into natural sentence units that fit cleanly on 1 to 2 visual lines (`max_words=16`):
```python
def split_into_dialogue_units(text: str, max_words: int = 16) -> list[str]:
    sentences = re.split(r"(?<=[.!?\n])\s+", text.strip())
    sentences = [s.strip() for s in sentences if s.strip()]
    if not sentences:
        return [text.strip()] if text.strip() else []

    units = []
    current_unit = []
    current_word_count = 0

    for s in sentences:
        s_words = len(s.split())
        if current_unit and (current_word_count + s_words > max_words):
            units.append(" ".join(current_unit))
            current_unit = [s]
            current_word_count = s_words
        else:
            current_unit.append(s)
            current_word_count += s_words

    if current_unit:
        units.append(" ".join(current_unit))

    return units
```

#### Parallel TTS Generation
Uses `ThreadPoolExecutor` to generate all segments simultaneously:
```python
def gen_unit(u: str) -> tuple[str, bytes]:
    return u, convert_to_wav(u)

with ThreadPoolExecutor(max_workers=max(1, len(units))) as executor:
    generated = await asyncio.to_thread(
        lambda: list(executor.map(gen_unit, units))
    )
```
* **Performance**: Generating 2–3 segments in parallel takes ~1.5–2.0 seconds total, completely eliminating sequential waiting latency.

---

### 5.2 Frontend: Audio & Subtitle Synchronization

#### `SpeechQueue` (`client/src/audio/SpeechQueue.ts`)
Manages sequential segment playback. When a segment finishes:
1. `audioPlayer.playAudioUrl(segment.audio, onProgress, onEnded)`
2. `onProgress` provides `currentTime` and `duration` directly from the audio element.
3. `onEnded` triggers the next segment in the queue immediately.
4. `interrupt()` stops playback instantly and purges remaining queue items.

#### `AudioPlayer` (`client/src/audio/AudioPlayer.ts`)
Connects the `HTMLAudioElement` to the Web Audio graph:
```typescript
if (!this.audioElement) {
  this.audioElement = new Audio();
  this.mediaSource = this.context.createMediaElementSource(this.audioElement);
  this.mediaSource.connect(this._gain); // _gain connects to _analyser -> destination
}
```
* **VRM Lip-Sync**: Because audio routes through `_gain` -> `_analyser`, `LipSyncController` continues sampling live RMS and frequency spectrum, keeping avatar lip movement in 100% sync.

#### `SubtitleOverlay` (`client/src/components/SubtitleOverlay.tsx`)
- **Defense-in-Depth Sanitization (`cleanSubtitleText(text)`)**:
  - Automatically strips any bracketed tags (e.g. `[annoyed]`, `[happy]`, `[sigh]`) that may have slipped past LLM generation or TTS processing.
  - Strips Markdown emphasis asterisks (`*any*` $\to$ `any`, removing lone `*`) to maintain pure, unformatted anime subtitle text.
- Formats incoming text into at most 2 visual lines (`formatTwoLines(text)`).
- Words brighten sequentially based on:
  ```typescript
  const prog = Math.min(1, Math.max(0, currentTime / (duration || 1)));
  const wordIdx = Math.min(words.length - 1, Math.floor(prog * words.length));
  ```
- **Strict Persistence**: The 2 lines stay solidly on screen for the entire duration of the segment's audio.
- When `onSegmentEnd` fires, all words turn bright white (`#ffffff`).
- When `onSegmentStart` fires for the next segment, the next 2 lines appear instantly.
- When `onAllSegmentsEnd` fires, the final lines hold for 1.5s, then fade out smoothly.

---

## 6. Visual Design & Anime Styling

### Typography & Border Stroke
* **Fonts**: `'Zen Kaku Gothic New', 'M PLUS Rounded 1c', sans-serif`
* **Weight**: `900` (Ultra-bold display weight)
* **Size**: `clamp(1.35rem, 3.2vw, 2.1rem)`
* **Outline Stroke**:
  ```css
  -webkit-text-stroke: 1.8px #0c0211;
  text-shadow:
    -2px -2px 0 #0c0211,
     2px -2px 0 #0c0211,
    -2px  2px 0 #0c0211,
     2px  2px 0 #0c0211,
     0 3px 6px rgba(0, 0, 0, 0.85);
  ```
  Ensures 100% legibility on any 3D lighting or character background without requiring an opaque box.

### Word State Colors
| State | Color | Text Shadow | Scale |
|---|---|---|---|
| **Upcoming** | `rgba(255, 255, 255, 0.65)` | Standard dark outline | `1.0` |
| **Speaking (Active)** | `#ff3d8b` (Hot Pink) | Dark outline + `0 0 14px rgba(255, 60, 140, 0.95)` | `1.06` + pulse animation |
| **Spoken** | `#ffffff` (Pure White) | Dark outline + soft white glow | `1.0` |

### Layout Rules
- **No Background Box**: Completely unconstrained transparent layout (`pointer-events: none`).
- **No Speaker Badge**: Direct clean subtitle presentation centered at `bottom: 8%`.
- **Max 2 Lines**: Guarantees dialogue never obscures the avatar's face or body.

---

## 7. Troubleshooting & Tuning Guide

### Adjusting Segment Length
If sentences are breaking into 2 lines too frequently or not frequently enough, tune `max_words` in [server/src/voice/loop.py](./server/src/voice/loop.py#L22):
- **Desktop / Wide Screens**: `max_words = 16-18` (fits 2 balanced lines cleanly).
- **Mobile / Portrait Screens**: `max_words = 10-12` prevents text from overflowing or creating 3+ lines.

### Lip-Sync Debugging
If the 3D avatar's mouth does not move during speech segment playback:
1. Ensure the user interacted with the page once (`AudioContext` requires user gesture before unmuting).
2. Check that `AudioPlayer.ts` has properly initialized `createMediaElementSource(audioElement)` and attached it to `this._gain`.

### Subtitle Persistence Debugging
If subtitles ever disappear prematurely:
1. Check browser console for `SpeechQueue.ts` logs.
2. Verify that `audio.onended` is not firing early (e.g. from an empty or truncated WAV buffer).
3. Ensure no unhandled `interrupt()` call was triggered by background microphone noise.

---

## 8. Subtitle Toggle Switches

Subtitles can be toggled on or off at both the server configuration level and live in the client UI:

### 1. Server Configuration ([server/src/config.py](./server/src/config.py#L6))
```python
# Subtitle display switch:
# True  -> Subtitles are sent and rendered on screen
# False -> Subtitles are turned off (character speaks without on-screen subtitles)
ENABLE_SUBTITLES = True
```
When set to `False`, the backend dispatches empty text for speech segments while keeping voice audio and lip-sync 100% active, preventing subtitle text from appearing on screen.

### 2. Client Live GUI Control ([client/src/components/SubtitleOverlay.tsx](./client/src/components/SubtitleOverlay.tsx#L61))
```tsx
const { showSubtitles } = useControls("Subtitles", {
  showSubtitles: { value: true, label: "Enable Subtitles" },
});
```
Provides an interactive toggle switch inside the browser's Leva control panel, allowing instant real-time toggling of subtitles without restarting any processes.

