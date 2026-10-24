# Audio-Synchronized Emotion & Facial Expression Specification

## 1. Overview & Objective

This specification details the architecture, data contracts, and engineering knowledge for the real-time audio-synchronized emotion system in the Akari Watanabe AI assistant.

The primary objective is to synchronize the 3D VRM avatar's facial expressions in **exact lockstep** with character speech:
1. Expressions must activate the exact millisecond the corresponding audio segment begins playing.
2. If dialogue shifts emotions mid-speech (e.g., from `[happy]` to `[surprised]`), the avatar's expression must dynamically shift with that sentence.
3. The expression must persist steadily throughout that sentence's audio playback.
4. When character speech physically finishes, the face must smoothly lerp back to `Neutral`.
5. The architecture must remain **shiftable anytime** (`EMOTION_SYNC_MODE = "synced" | "stream" | "off"`), preserving legacy streaming behaviors without breaking core types.

---

## 2. Architecture & Data Flow

```
+-----------------------------------------------------------------------------------+
|                                 BACKEND (Python)                                  |
|                                                                                   |
|  1. LLM (Mistral) -> Streams response with tags: "[happy] Hello! [surprised] Wait!" |
|  2. EmotionFeatureManager -> Detects mode ("synced" vs "stream")                  |
|  3. split_dialogue_units_with_emotions() -> Partitions text into units + emotions |
|     - Unit 0: ("Hello!", "Happy")                                                 |
|     - Unit 1: ("Wait!", "Surprised")                                              |
|  4. Parallel TTS -> Synthesizes WAV audio for each unit                           |
|  5. Broadcaster -> Dispatches `speech_segment` events with active `emotion`       |
+-----------------------------------------------------------------------------------+
                                          |
                                WebSocket JSON Events
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                                 FRONTEND (React)                                  |
|                                                                                   |
|  1. AvatarSocket -> Enqueues `speech_segment` into SpeechQueue                    |
|  2. SpeechQueue.playNext():                                                       |
|     - Segment 0 starts -> Emits { type: "emotion", emotion: "Happy" }             |
|     - AudioPlayer plays Segment 0 audio -> VRM face is Happy                      |
|     - Segment 0 ends -> Segment 1 starts                                          |
|     - Segment 1 starts -> Emits { type: "emotion", emotion: "Surprised" }         |
|     - AudioPlayer plays Segment 1 audio -> VRM face dynamically shifts to Surprised |
|  3. SpeechQueue.notifyAllEnd():                                                   |
|     - Drained audio -> Emits { type: "speech_end" }                               |
|     - EmotionController receives `speech_end` -> Smoothly lerps face to Neutral   |
+-----------------------------------------------------------------------------------+
```

---

## 3. Protocol & Event Schema

### Event: `speech_segment` (Updated with optional emotion)
Carries the dialogue unit, base64 audio URI, and active emotion tag:
```typescript
export interface SpeechSegmentEvent {
  type: "speech_segment";
  text: string;           // Dialogue text for this segment (stripped of brackets)
  audio: string;          // Base64 Data URI: "data:audio/wav;base64,..."
  is_last: boolean;       // True if this is the final segment of the turn
  segment_index: number;  // 0-indexed segment order
  total_segments: number; // Total count of segments in this turn
  emotion?: string;       // Active emotion preset ("Happy", "Sad", "Angry", "Surprised", "Relaxed", "Neutral")
}
```

### Event: `emotion` (Standard Avatar Event)
Dispatched internally by `SpeechQueue` or by the backend in streaming mode:
```typescript
export interface EmotionEvent {
  type: "emotion";
  emotion: string; // e.g. "Happy", "Surprised", "Neutral"
}
```

### Event: `speech_end` (Standard Avatar Event)
Emitted by `SpeechQueue` when physical audio playback drains:
```typescript
export interface SpeechEndEvent {
  type: "speech_end";
}
```

---

## 4. Key Knowledge & Root Cause Analysis

### Pitfall 1: Premature Firing During Token Streaming
* **What Happened**: Originally, emotion tags were detected during `stream_chat` and immediately dispatched over the WebSocket: `dispatch(emotion(tag_emotion))`.
* **Why It Failed**: At that moment, the LLM is still generating text. TTS synthesis has not even started yet. Generating audio for all segments takes ~1.5–2.5 seconds. As a result, the avatar smiled or looked surprised in complete silence 2.5 seconds before any voice came out.
* **Key Takeaway**: Dialogue-derived emotional states must be bound to audio playback time, not LLM generation time.

### Pitfall 2: Premature Neutral Wipe (Still-Face Bug)
* **What Happened**: The server executed `dispatch(emotion("Neutral"))` immediately after the loop dispatching `speech_segment` events.
* **Why It Failed**: In legacy monolithic streaming (`stream_audio`), the thread blocked until all audio played out. In segment-based parallel TTS, dispatching `speech_segment` is non-blocking and takes < 2ms. Calling `dispatch(emotion("Neutral"))` right after meant the browser received `Neutral` at millisecond 0 of audio playback. Her face immediately reset to Neutral, causing her to speak with a completely still face throughout the entire response.
* **Key Takeaway**: The server does not know when audio finishes playing on the client sound card. Only the client audio queue (`audio.onended`) knows when speech has concluded. The reset to `Neutral` must be triggered by `SpeechQueue.notifyAllEnd()`.

### Pitfall 3: Single-Tag Blindness (Loss of Multi-Emotion Shifts)
* **What Happened**: When splitting dialogue into units, the code stripped all emotion tags (`clean_reply = strip_all_emotion_tags(raw_reply)`) and then split into sentences.
* **Why It Failed**: Any subsequent emotion tags (e.g., `[surprised]` or `[angry]` in line 2 or 3) were destroyed before sentence chunking. The system only knew about the first detected tag, locking the character to that single expression for the entire turn.
* **Key Takeaway**: Use tag-retaining regex tokenization (`split_dialogue_units_with_emotions`) to partition the text so each dialogue unit retains its active emotion.

### Pitfall 5: Unrecognized Emotion Tag Leakage into Subtitles & Spoken Dialogue
* **What Happened**: When using Tsundere prompts or third-party LLMs (e.g. Free.ai Qwen 2.5 7B), the model frequently output expressive variations such as `[annoyed]`, `[blush]`, `[flustered]`, or `[pouting]`. Because `EMOTION_TAG_PATTERN` was strictly limited to `r"\[(happy|sad|angry|surprised|relaxed|neutral)\]"`, tags like `[annoyed]` were ignored by the regex.
* **Why It Failed**: 
  1. `strip_all_emotion_tags()` failed to remove `[annoyed]`, leaving it inside `current_sentence`.
  2. TTS received `[annoyed]` in its raw text, causing speech synthesis glitches or vocalizing the tag.
  3. `speech_segment.text` sent to the frontend contained `"[annoyed] Ugh, do you have *any* sense of decorum?..."`, directly displaying `[annoyed]` in on-screen subtitles.
  4. The VRM avatar received `Neutral` instead of reacting with an annoyed/angry facial expression.
* **Key Takeaway**:
  1. **Comprehensive Regex**: Use `r"\[([a-zA-Z_\-]+)\]"` to match **any** bracketed word.
  2. **Canonical Alias Mapping**: Map common conversational expressions to the 6 core VRM presets (e.g., `annoyed`, `mad`, `pouting` $\to$ `Angry`; `blush`, `flustered`, `teasing` $\to$ `Happy`).
  3. **Defense-in-Depth Sanitization**: Clean subtitles on both backend (`strip_all_emotion_tags`) AND frontend (`cleanSubtitleText` in `SubtitleOverlay.tsx`).
  4. **Markdown Formatting Stripping**: Strip Markdown asterisks used for emphasis (`*any*` $\to$ `any`, removing lone `*`) so markdown formatting does not bleed into subtitles.

---

## 5. Detailed Component Specifications

### 5.1 Emotion Parser & Dialogue Segmenter (`server/src/voice/emotion_feature.py`)

#### Canonical Emotion Alias Dictionary
```python
EMOTION_ALIASES: dict[str, str] = {
    # 6 Core VRM emotions
    "neutral": "Neutral",
    "happy": "Happy",
    "sad": "Sad",
    "angry": "Angry",
    "relaxed": "Relaxed",
    "surprised": "Surprised",

    # Tsundere & expressive aliases (matching client EmotionController)
    "annoyed": "Angry",
    "mad": "Angry",
    "furious": "Angry",
    "pouting": "Angry",
    "irritated": "Angry",
    "grumpy": "Angry",

    "blush": "Happy",
    "flustered": "Happy",
    "smirk": "Happy",
    "teasing": "Happy",
    "joy": "Happy",
    "embarrassed": "Happy",
    "excited": "Happy",

    "shocked": "Surprised",
    "confused": "Surprised",
    "gasp": "Surprised",
    "amazed": "Surprised",

    "unhappy": "Sad",
    "crying": "Sad",
    "sulky": "Sad",
    "depressed": "Sad",
    "hurt": "Sad",

    "calm": "Relaxed",
    "sleepy": "Relaxed",
    "tired": "Relaxed",
}
```

#### Multi-Emotion Partitioning Algorithm
Splits text across any bracketed emotion tags and punctuation boundaries while resolving the active canonical emotion:
```python
def split_dialogue_units_with_emotions(
    raw_text: str, max_words: int = 16
) -> list[tuple[str, str]]:
    tokens = re.split(
        r"(\[[a-zA-Z_\-]+\])",
        raw_text,
        flags=re.IGNORECASE,
    )
    current_emotion = "Neutral"
    sections: list[tuple[str, str]] = []

    for token in tokens:
        if not token:
            continue
        tag_match = EMOTION_TAG_PATTERN.fullmatch(token.strip())
        if tag_match:
            tag_name = tag_match.group(1).lower()
            if tag_name in EMOTION_ALIASES:
                current_emotion = EMOTION_ALIASES[tag_name]
        else:
            text = strip_all_emotion_tags(token)
            if text:
                sections.append((text, current_emotion))

    dialogue_units: list[tuple[str, str]] = []
    for text, section_emotion in sections:
        sentences = re.split(r"(?<=[.!?\n])\s+", text)
        sentences = [s.strip() for s in sentences if s.strip()]
        if not sentences:
            sentences = [text]

        current_unit = []
        current_word_count = 0
        for s in sentences:
            s_words = len(s.split())
            if current_unit and (current_word_count + s_words > max_words):
                dialogue_units.append((" ".join(current_unit), section_emotion))
                current_unit = [s]
                current_word_count = s_words
            else:
                current_unit.append(s)
                current_word_count += s_words

        if current_unit:
            dialogue_units.append((" ".join(current_unit), section_emotion))

    return dialogue_units
```

---

### 5.2 Shiftable Configuration (`server/src/config.py`)

```python
# Emotion synchronization mode:
# "synced" -> Facial expression synchronizes per segment with audio playback and holds until speech finishes
# "stream" -> Legacy behavior: dispatches emotion during token streaming
# "off"    -> Disables emotion tags (stays Neutral)
EMOTION_SYNC_MODE = "synced"
```

* **`"synced"` Mode**: Partitions dialogue units with emotions, passes `emotion` in `speech_segment`, and leaves completion timing to the client.
* **`"stream"` Mode**: Reverts immediately to legacy token-streaming dispatch without code changes.

---

### 5.3 Client Playback & Completion (`client/src/audio/SpeechQueue.ts`)

#### Per-Segment Playback Activation
Inside `playNext()`:
```typescript
const segment = this.queue.shift()!;
this.isPlaying = true;
this.currentSegment = segment;

// Trigger emotion shift for this exact dialogue segment as audio begins
if (segment.emotion) {
  avatarEvents.emit({ type: "emotion", emotion: segment.emotion });
}

this.notifyStart(segment);
```

#### Physical Playback Drained (`notifyAllEnd`)
```typescript
private notifyAllEnd() {
  for (const cb of this.onAllEndListeners) {
    try {
      cb();
    } catch (err) {
      console.error("[SpeechQueue] allEnd listener error:", err);
    }
  }
  // Signal speech end on the avatar event bus to return facial expressions to Neutral
  avatarEvents.emit({ type: "speech_end" });
}
```

---

## 6. VRM Expression Presets & Mapping

`EmotionController.ts` smoothly lerps expression weights (`lerpSpeed = 4`) between presets:

| Emotion Tag | VRM Expression Preset | Facial Features |
|---|---|---|
| `[happy]` | `Happy` | Raised cheeks, smiling eyes, slight mouth curve |
| `[surprised]` | `Surprised` | Wide open eyes, arched eyebrows |
| `[angry]` | `Angry` | Lowered brow, furrowed center |
| `[sad]` | `Sad` | Downturned eyebrows, subdued expression |
| `[relaxed]` | `Relaxed` | Soft lowered eyelids, peaceful resting face |
| `[neutral]` | `Neutral` | Default resting facial geometry |

> [!NOTE]
> `EmotionController` explicitly skips mouth visemes (`aa`, `ih`, `ou`, `ee`, `oh`), ensuring mouth open/close movements remain 100% controlled by `LipSyncController` and Web Audio FFT without conflict.
