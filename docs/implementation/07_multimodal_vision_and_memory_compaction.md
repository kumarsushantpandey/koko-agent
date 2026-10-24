# Phase 07: Multimodal Vision & Conversation Memory Compaction
**Task**: Build client offscreen canvas image downscaling, hybrid multimodal vision routing, and summary buffer memory compaction.  
**Related Phase**: `./docs/implementation/06_audio_synchronized_emotion_and_lipsync.md`  
**Referenced Skill**: `./.agents/skills/websocket-streaming-companion-bridge/SKILL.md`

---

## 1. Architectural Goal

1. **Multimodal Input Channels**: Support camera picker, drag-and-drop, and clipboard paste (`Ctrl+V`) without saturating WebSocket bandwidth.
2. **Client Offscreen Compression**: Downscale high-resolution images to $\le 1280 \times 1280$ JPEG ($quality = 0.85$), reducing payloads from 20MB to under 150KB.
3. **Hybrid Vision Routing**:
   - For native multimodal models (Ministral 3, Qwen 3 VL, GPT-4o, Pixtral 12B): pass the base64 Data URI directly.
   - For text-only models (OpenAI GPT-OSS, Mistral 8B, Qwen 7B): run a background vision analyzer (`vision.py`) and inject structured scene descriptions into the prompt context.
4. **Summary Buffer Memory Compaction**: Automatically compact older dialogue turns when history exceeds 16 messages or 8,000 characters while preserving recent turns verbatim.

![Chat Screen](./assets/chat_screen.png)

---

## 2. Agent Skill & Implementation Prompt

When delegating this phase to an AI agent, use the following prompt:

```markdown
Build multimodal vision and summary buffer compaction:
1. In `./client/src/utils/imageUtils.ts`, create `processImageFile(file: File)`:
   - Use an offscreen `HTMLCanvasElement` to scale images proportionally to fit within 1280x1280px.
   - Re-encode as `image/jpeg` with quality 0.85.
2. In `./client/src/components/ChatInput.tsx`, wire up:
   - Camera action button, drag-and-drop overlay glow, and `onPaste` clipboard handler.
   - Dismissible image preview chip (`44x44px` thumbnail).
3. In `./server/src/llm/vision.py`, build `analyze_image(data_uri)` extracting objective descriptions (subjects, setting, readable text, style).
4. In `./server/src/llm/compactor.py`, implement `compact_conversation_async(history)`:
   - Gating threshold: 16 messages or 8,000 characters.
   - Preserves recent 6 messages verbatim; compiles older messages into dense background memory.
```

---

## 3. Core Implementation

### 3.1 Offscreen Canvas Downscaler (`./client/src/utils/imageUtils.ts`)

```typescript
export interface ProcessedImage {
  dataUri: string;
  name: string;
  sizeBytes: number;
}

export async function processImageFile(file: File, maxDim: number = 1280, quality: number = 0.85): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas 2D context unavailable"));

        ctx.drawImage(img, 0, 0, width, height);
        const dataUri = canvas.toDataURL("image/jpeg", quality);
        resolve({
          dataUri,
          name: file.name,
          sizeBytes: Math.round((dataUri.length * 3) / 4),
        });
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

### 3.2 Background Vision Analyzer (`./server/src/llm/vision.py`)

When routing images to text-only models:

```python
def analyze_image(data_uri: str) -> str:
    """Extracts structured objective visual features for text-only LLMs."""
    prompt = """Analyze this image with maximum detail and zero fictional bias:
1. Primary Subjects: appearance, clothing, expressions, poses, colors.
2. Setting & Environment: indoor/outdoor, objects, background layout, lighting.
3. Visible Text & Graphics: transcribe any readable text, logos, or signs verbatim.
4. Composition & Style: photo, illustration, screenshot, perspective."""

    # Query vision-capable fallback model
    resp = client.chat.completions.create(
        model="mistral.ministral-3-8b-instruct",
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": data_uri}},
            ],
        }],
        max_tokens=1000,
    )
    return resp.choices[0].message.content or ""
```

### 3.3 Summary Buffer Compactor (`./server/src/llm/compactor.py`)

```python
COMPACTION_THRESHOLD_MESSAGES = 16
KEEP_RECENT_MESSAGES = 6

def should_compact(history: list) -> bool:
    if len(history) >= COMPACTION_THRESHOLD_MESSAGES:
        return True
    total_chars = sum(len(str(getattr(m, "content", ""))) for m in history)
    return total_chars >= 8000

async def compact_conversation_async(history: list) -> list:
    if not should_compact(history):
        return history

    older_messages = history[:-KEEP_RECENT_MESSAGES]
    recent_messages = history[-KEEP_RECENT_MESSAGES:]

    summary_prompt = "Summarize the key facts, user preferences, and topics discussed in this conversation:\n"
    # Execute background LLM summarization
    summary_text = await generate_summary(older_messages)

    return [
        UserMessage(content=f"[Context from earlier conversation:\n{summary_text}\n(Background memory)]"),
        AssistantMessage(content="[Understood, I remember everything we talked about.]"),
    ] + recent_messages
```

---

## 4. Verification & Testing Instructions

### 4.1 Image Paste & Upload Test
1. In the browser chat screen (`http://localhost:5173/?screen=chat`):
2. Take a screenshot (`Win + Shift + S` or `Cmd + Shift + 4`) and press `Ctrl+V` inside the chat input bar.
3. **Verify**:
   - The preview chip appears displaying thumbnail and file size (under 150KB).
   - Sending the image with *"What do you see?"* produces Tsundere dialogue acknowledging the image contents.
4. Test one-click removal: attach an image and click the `IconX` dismiss button. Verify the chip disappears and input state clears.

### 4.2 Compactor Threshold Test
Create `./server/scratch_test_compactor.py`:
```python
from mistralai.client.models import UserMessage, AssistantMessage
from src.llm.compactor import should_compact

# 10 turns (20 messages)
dummy_history = []
for i in range(10):
    dummy_history.append(UserMessage(content=f"Message {i}"))
    dummy_history.append(AssistantMessage(content=f"Reply {i}"))

assert should_compact(dummy_history) is True
print("✓ Compactor threshold gate verified!")
```

Run test:
```bash
cd server
uv run python scratch_test_compactor.py
```
**Expected Output**:
`✓ Compactor threshold gate verified!`
