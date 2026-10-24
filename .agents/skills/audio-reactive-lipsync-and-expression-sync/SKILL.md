---
name: audio-reactive-lipsync-and-expression-sync
description: Patterns and algorithms for 0-latency audio-reactive mouth lip-sync via Web Audio FFT and synchronized 3D VRM facial expressions with sentence-level emotion tracking.
---

# Audio-Reactive Lip-Sync & Expression Synchronization Skill

Use this skill when implementing audio-reactive lip synchronization (mouth open/visemes) and facial emotion expressions on 3D characters, anime avatars, or VTuber agents.

---

## 1. Core Principles

1. **Audio-Reactive > Phoneme Timelines**: Do not rely on server-side phoneme schedules. Web Audio playback jitter causes desync. Real-time frequency analysis in the browser provides exact 0ms synchronization.
2. **Strict Domain Isolation**:
   - LipSyncController owns ONLY mouth visemes (`aa`, `ih`, `ou`, `ee`, `oh`).
   - EmotionController owns eyebrows, eyelids, cheeks, and head tilt (`Happy`, `Sad`, `Angry`, etc.), and MUST NEVER touch mouth visemes.
3. **Audio-Time Emotion Binding**: Emotion tags (`[happy]`, `[angry]`) must take visual effect when the corresponding speech segment *physically begins playing*, not when the LLM generates tokens.

---

## 2. Web Audio FFT Analyser Setup

Connect an `AnalyserNode` to the client's `AudioContext`:

```typescript
export class AudioAnalyser {
  private analyser: AnalyserNode;
  private dataArray: Uint8Array;

  constructor(audioContext: AudioContext) {
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.8;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
  }

  public getAnalyserNode(): AnalyserNode {
    return this.analyser;
  }

  public getRMS(): number {
    this.analyser.getByteFrequencyData(this.dataArray);
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i] * this.dataArray[i];
    }
    return Math.sqrt(sum / this.dataArray.length) / 255.0;
  }
}
```

---

## 3. Viseme Blendshape Mapping Algorithm

In the 60 FPS frame render loop (`useFrame`):

```typescript
export function updateLipSync(vrm: VRM, rms: number, noiseGate: number = 0.05) {
  if (rms < noiseGate) {
    // Silence: close mouth smoothly
    vrm.expressionManager?.setValue("aa", 0);
    vrm.expressionManager?.setValue("ih", 0);
    vrm.expressionManager?.setValue("ou", 0);
    vrm.expressionManager?.setValue("ee", 0);
    vrm.expressionManager?.setValue("oh", 0);
    return;
  }

  // Non-linear amplitude expansion
  const openWeight = Math.min(1.0, Math.pow(rms * 2.2, 1.2));
  vrm.expressionManager?.setValue("aa", openWeight * 0.8);
  vrm.expressionManager?.setValue("oh", openWeight * 0.4);
}
```

---

## 4. Multi-Emotion Dialogue Partitioning (Backend)

When the LLM outputs dialogue with emotion markers:
`"[happy] Look at this! [angry] But don't you dare touch it!"`

Partition the text into distinct dialogue chunks while preserving each chunk's active emotion tag:

```python
import re

EMOTION_ALIASES = {
    "happy": "Happy", "blush": "Happy", "flustered": "Happy",
    "angry": "Angry", "annoyed": "Angry", "pouting": "Angry",
    "sad": "Sad", "sulky": "Sad",
    "surprised": "Surprised", "shocked": "Surprised",
    "relaxed": "Relaxed", "calm": "Relaxed",
    "neutral": "Neutral",
}

def split_dialogue_units_with_emotions(text: str, max_words: int = 16) -> list[tuple[str, str]]:
    tokens = re.split(r"(\[[a-zA-Z_\-]+\])", text)
    current_emotion = "Neutral"
    units = []

    for token in tokens:
        match = re.fullmatch(r"\[([a-zA-Z_\-]+)\]", token.strip())
        if match:
            tag = match.group(1).lower()
            current_emotion = EMOTION_ALIASES.get(tag, "Neutral")
        else:
            clean_text = token.strip()
            if clean_text:
                units.append((clean_text, current_emotion))
    return units
```

---

## 5. Client Sequential SpeechQueue Lifecycle

```typescript
// Enqueue segment
speechQueue.enqueue({
  audioUrl: segment.audio,
  emotion: segment.emotion, // e.g. "Happy"
});

// Inside SpeechQueue.playNext():
if (segment.emotion) {
  // Fire visual expression the millisecond audio starts
  avatarEvents.emit({ type: "emotion", emotion: segment.emotion });
}

// When all audio has drained:
audio.onended = () => {
  if (this.queue.length === 0) {
    // Reset face to Neutral
    avatarEvents.emit({ type: "speech_end" });
  }
};
```
