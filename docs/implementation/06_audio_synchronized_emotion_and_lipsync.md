# Phase 06: Audio-Synchronized Emotion & Lip-Sync Subsystem
**Task**: Build real-time audio-reactive lip synchronization via Web Audio FFT and exact audio-synchronized 3D VRM facial expressions.  
**Related Phase**: `./docs/implementation/05_agentic_tool_calling_and_search.md`  
**Referenced Skill**: `./.agents/skills/audio-reactive-lipsync-and-expression-sync/SKILL.md`

---

## 1. Architectural Goal

Synchronize character facial expressions and mouth movements in exact lockstep with character speech:
1. **0ms Audio-Reactive Lip-Sync**: Web Audio `AnalyserNode` frequency analysis mapping live RMS energy to blendshape weights (`aa`, `ih`, `ou`, `ee`, `oh`).
2. **Audio-Time Emotion Binding**: Trigger facial expressions the exact millisecond audio playback begins, not during text token streaming.
3. **Multi-Emotion Sentence Shifts**: Seamlessly transition expressions mid-turn (e.g. `[happy]` $\to$ `[angry]`) as dialogue progresses.
4. **Natural Reset to Neutral**: Smoothly lerp back to `Neutral` when character speech concludes.
5. **Morph Target Domain Isolation**: Ensure `EmotionController` never drives mouth visemes, preventing mouth twitching or locking during speech.

---

## 2. Agent Skill & Implementation Prompt

When delegating this phase to an AI agent, use the following prompt:

```markdown
Build the audio-synchronized emotion and lip-sync pipeline:
1. In `./server/src/voice/emotion_feature.py`:
   - Define `EMOTION_ALIASES` mapping variations (annoyed -> Angry, blush -> Happy, etc.) to the 6 core VRM presets.
   - Implement `split_dialogue_units_with_emotions()` partitioning dialogue by punctuation (`[.!?\n]`) and 16-word limits while retaining active emotion per chunk.
2. In `./server/src/chat/loop.py`:
   - Synthesize WAV audio in parallel for each sentence unit via `convert_to_wav`.
   - Dispatch `speech_segment` events with `audio` (base64 WAV Data URI), `text`, and `emotion`.
3. In `./client/src/audio/SpeechQueue.ts`:
   - Fire `avatarEvents.emit({ type: "emotion", emotion: segment.emotion })` when physical audio playback starts.
   - Emit `speech_end` when the queue drains to lerp facial expressions back to `Neutral`.
4. In `./client/src/components/character/LipSyncController.ts`:
   - Read RMS energy from Web Audio `AnalyserNode` every frame and set mouth blendshape weights (`aa`, `ih`, `ou`, `ee`, `oh`).
```

---

## 3. Core Implementation

### 3.1 Sentence-Level Dialogue Partitioning (`./server/src/voice/emotion_feature.py`)

```python
import re

EMOTION_TAG_PATTERN = re.compile(r"\[([a-zA-Z_\-]+)\]", re.IGNORECASE)

EMOTION_ALIASES: dict[str, str] = {
    "happy": "Happy", "blush": "Happy", "flustered": "Happy", "teasing": "Happy",
    "angry": "Angry", "annoyed": "Angry", "pouting": "Angry", "mad": "Angry",
    "sad": "Sad", "sulky": "Sad", "crying": "Sad",
    "surprised": "Surprised", "shocked": "Surprised", "confused": "Surprised",
    "relaxed": "Relaxed", "calm": "Relaxed", "sleepy": "Relaxed",
    "neutral": "Neutral",
}

def split_dialogue_units_with_emotions(raw_text: str, max_words: int = 16) -> list[tuple[str, str]]:
    tokens = re.split(r"(\[[a-zA-Z_\-]+\])", raw_text, flags=re.IGNORECASE)
    current_emotion = "Neutral"
    sections = []

    for token in tokens:
        if not token: continue
        tag_match = EMOTION_TAG_PATTERN.fullmatch(token.strip())
        if tag_match:
            tag_name = tag_match.group(1).lower()
            if tag_name in EMOTION_ALIASES:
                current_emotion = EMOTION_ALIASES[tag_name]
        else:
            text = re.sub(r"\[([a-zA-Z_\-]+)\]", "", token).strip()
            if text:
                sections.append((text, current_emotion))

    dialogue_units = []
    for text, section_emotion in sections:
        sentences = re.split(r"(?<=[.!?\n])\s+", text)
        for s in sentences:
            if s.strip():
                dialogue_units.append((s.strip(), section_emotion))
    return dialogue_units
```

### 3.2 Client Speech Playback Queue (`./client/src/audio/SpeechQueue.ts`)

```typescript
import { avatarEvents } from "../networking/EventBus";
import { audioPlayer } from "./AudioPlayer";

export interface SpeechSegmentItem {
  audio: string;
  text: string;
  emotion?: string;
}

export class SpeechQueue {
  private queue: SpeechSegmentItem[] = [];
  private isPlaying = false;

  enqueue(item: SpeechSegmentItem) {
    this.queue.push(item);
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  private async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      // All audio drained: lerp face back to Neutral
      avatarEvents.emit({ type: "speech_end" });
      return;
    }

    const segment = this.queue.shift()!;
    this.isPlaying = true;

    // Trigger emotion shift exact millisecond audio starts
    if (segment.emotion) {
      avatarEvents.emit({ type: "emotion", emotion: segment.emotion });
    }

    await audioPlayer.play(segment.audio);
    this.playNext();
  }
}
```

### 3.3 Audio-Reactive Lip-Sync Controller (`./client/src/components/character/LipSyncController.ts`)

```typescript
import type { VRM } from "@pixiv/three-vrm";
import { audioAnalyser } from "../../audio/AudioAnalyser";

export class LipSyncController {
  private noiseGate = 0.04;

  update(delta: number, vrm: VRM) {
    if (!vrm.expressionManager) return;

    const rms = audioAnalyser.getRMS();
    if (rms < this.noiseGate) {
      vrm.expressionManager.setValue("aa", 0);
      vrm.expressionManager.setValue("ih", 0);
      vrm.expressionManager.setValue("ou", 0);
      vrm.expressionManager.setValue("ee", 0);
      vrm.expressionManager.setValue("oh", 0);
      return;
    }

    const openWeight = Math.min(1.0, Math.pow(rms * 2.2, 1.2));
    vrm.expressionManager.setValue("aa", openWeight * 0.75);
    vrm.expressionManager.setValue("oh", openWeight * 0.35);
  }
}
```

---

## 4. Verification & Testing Instructions

### 4.1 Automated Emotion Splitter Test
Create `./server/scratch_test_emotions.py`:
```python
from src.voice.emotion_feature import split_dialogue_units_with_emotions

test_str = "[happy] Look what I found! [angry] But don't touch it. [surprised] Wait, you like it?"
units = split_dialogue_units_with_emotions(test_str)

assert units[0] == ("Look what I found!", "Happy")
assert units[1] == ("But don't touch it.", "Angry")
assert units[2] == ("Wait, you like it?", "Surprised")
print("✓ Emotion-retaining sentence partitioning verified!")
```

Run test:
```bash
cd server
uv run python scratch_test_emotions.py
```
**Expected Output**:
`✓ Emotion-retaining sentence partitioning verified!`

### 4.2 Interactive Voice & Expression Test
1. In the browser chat screen (`http://localhost:5173/?screen=chat`):
2. Send: *"Say something happy, then get really angry, then act surprised!"*
3. **Observe Akari's Face**:
   - Sentence 1 plays: Her eyes smile and cheeks lift (`Happy`). Her mouth moves in exact audio sync.
   - Sentence 2 plays: Her brow lowers furrowed (`Angry`). Her mouth continues moving smoothly without distortion.
   - Sentence 3 plays: Her eyes open wide (`Surprised`).
   - Audio finishes: Her face smoothly lerps back to `Neutral` resting position.
