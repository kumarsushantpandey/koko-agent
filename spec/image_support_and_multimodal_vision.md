# Image Support and Multimodal Vision Architecture Specification

**Status**: Active  
**Date**: 2026-09-28  
**Feature Branch**: `feat/image-support`  
**Components**: `./client/src/components/ChatInput.tsx`, `./client/src/utils/imageUtils.ts`, `./server/src/llm/vision.py`, `./server/src/llm/provider.py`, `./server/src/llm/mistral_model.py`, `./server/src/llm/openrouter_model.py`, `./server/src/bridge/websocket_server.py`, `./server/src/chat/loop.py`

---

## 1. Executive Summary

This specification outlines the multimodal image support system for the Akari Watanabe AI. Users can send images alongside messages via a camera file picker, drag-and-drop, or clipboard pasting (`Ctrl+V`). The assistant perceives the visual input, reacts in character (Tsundere gyaru persona) with synchronized facial expressions and speech audio, and maintains visual awareness across conversational turns.

The architecture employs a **Hybrid Vision Pipeline**:
1. **Native Multimodal Vision**: When a vision-capable model is selected (`pixtral-12b-2409` on Mistral AI, or `openrouter/free` on OpenRouter), raw base64 image data is passed directly into the model's native multimodal API endpoint.
2. **Background Vision Feature Extraction**: When a text-only model is active (e.g. `ministral-8b-latest`, `mistral-small-latest`, `qwen7b`, `ling-3.0-flash-sante:free`), a dedicated vision model automatically analyzes the image in the background, extracts structured visual descriptions, and seamlessly injects the visual context into the user's prompt without crashing the text-only model.

---

## 2. Client-Side Image Preprocessing & UI/UX

### 2.1 Offscreen Canvas Compression (`./client/src/utils/imageUtils.ts`)
To prevent large image payloads (e.g. 10MB–20MB DSLR/phone photos) from saturating the WebSocket connection and exhausting client/server memory:
- An offscreen `HTMLCanvasElement` decodes and proportionally scales down high-resolution images to a maximum bounding box of $1280 \times 1280$ pixels.
- The image is re-encoded as an optimized JPEG (`quality = 0.85`), compressing typical files to under 150 KB in under 50 milliseconds.
- Computes actual byte sizes and dimensions for live UI telemetry.

### 2.2 Glassmorphic Input Bar Integration (`./client/src/components/ChatInput.tsx`)
- **Camera Action Button**: Pinned to the left side of the input bar (`.chat-btn-camera`) to trigger the hidden `<input type="file" accept="image/*" />`.
- **Drag-and-Drop**: The entire `.chat-input-bar` listens to `onDragOver`, `onDragLeave`, and `onDrop`, illuminating with an ambient purple glow (`.dragging`) when an image is hovered over it.
- **Clipboard Paste**: `onPaste` intercepts pasted image blobs directly from the system clipboard (e.g., screenshots or copied images).
- **Preview Chip**: Displays a rounded thumbnail (`44x44px`), file name, and file size above the textarea before sending. A dismiss button (`IconX`) enables one-click cancellation.
- **Clean 3D Avatar Scene**: In accordance with user preference, sent images do not clutter the 3D scene after dispatch, keeping Akari's 3D avatar viewport completely clean and immersive.

---

## 3. WebSocket Protocol & Payload Specification

### 3.1 Client to Server: `chat_message`
Images are transmitted as base64 Data URIs (`data:image/jpeg;base64,...`) within the JSON payload:
```json
{
  "type": "chat_message",
  "text": "Look at what I'm wearing!",
  "image": "data:image/jpeg;base64,...",
  "provider": "mistral",
  "model": "pixtral-12b-2409",
  "tools_enabled": true,
  "timezone": "America/New_York"
}
```

### 3.2 Server Configuration Event: `config`
Announces `vision_supported` capability flags to connected clients:
```json
{
  "type": "config",
  "chat_input_enabled": true,
  "llm_provider": "mistral",
  "llm_model": "pixtral-12b-2409",
  "vision_supported": true,
  "tool_calling_enabled": false,
  "tool_calling_supported": false
}
```

---

## 4. Backend Multimodal Inference Architecture

### 4.1 Hybrid Vision Router (`./server/src/llm/provider.py`)
The router checks `is_vision_supported(provider, model)`.
```python
native_vision = is_vision_supported(_active_provider, _active_model)
if image:
    if not native_vision:
        # Step 1: Run comprehensive visual extraction
        visual_analysis = analyze_image(image)
        # Step 2: Inject visual context directly without excess prompt
        if prompt and prompt.strip():
            effective_prompt = f"[Image description:\n{visual_analysis}]\n\n{prompt}"
        else:
            effective_prompt = f"[Image description:\n{visual_analysis}]"
        pass_image = None
    else:
        # Native vision model: pass image Data URI directly
        pass_image = image
```

### 4.2 Background Vision Analyzer (`./server/src/llm/vision.py`)
When routing to text-only models, `analyze_image(data_uri)` queries Mistral `pixtral-12b-2409` or OpenRouter `openrouter/free` to extract a comprehensive, objective visual description:
- **Zero Persona/Anime Bias**: Evaluates the image purely from an objective standpoint without conversational or fictional framing.
- **Detailed Structure**:
  1. Subjects: physical appearance, poses, facial expressions, actions, hairstyles, clothing, colors, and textures.
  2. Setting & Environment: indoor/outdoor context, background objects, furniture, architecture, landscape, lighting, and spatial layout.
  3. Visible Text & Graphics: verbatim transcription of all readable text, signs, logos, UI elements, or diagrams.
  4. Composition & Style: medium (photography, digital art, illustration, screenshot), perspective, and subtle details.
- **Generous Token Budget**: 1000 max tokens ensuring full visual context is preserved without truncation.

### 4.3 Multimodal Message Formatting

#### Mistral AI (`./server/src/llm/mistral_model.py`)
```python
if image:
    user_msg = UserMessage(
        content=[
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": image}},
        ]
    )
else:
    user_msg = UserMessage(content=prompt)
```

#### OpenRouter (`./server/src/llm/openrouter_model.py`)
```python
if image:
    messages.append({
        "role": "user",
        "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": image}},
        ],
    })
```

---

## 5. Persona & 3D Expression Continuity

When given visual inputs, Akari maintains strict adherence to her persona prompt:
- **Tags Emitted**: `[happy]`, `[sad]`, `[angry]`, `[surprised]`, `[relaxed]`, `[neutral]`.
- **Zero Asterisks**: Complies with the absolute ban on markdown asterisks and roleplay actions.
- **VRM Synchronization**: Facial morph targets update according to the detected emotion tags (e.g. blushing `[happy]` when complimented on her appearance or pouting `[angry]` when teased about details in a drawing).

---

## 6. Verification & Test Results

1. **Native Vision (Mistral Pixtral `pixtral-12b-2409`)**:
   - Sent `./client/public/akari_avatar.jpg`.
   - Result: Correctly identified avatar cat ears, purple lighting, and choker necklace, responding in tsundere gyaru voice with `[happy]`, `[angry]`, `[surprised]`, `[relaxed]`.
2. **Native Vision (OpenRouter `openrouter/free`)**:
   - Successfully routed to modality-aware vision models and processed image without error.
3. **Hybrid Vision Fallback (Mistral `ministral-8b-latest`)**:
   - Background analyzer generated visual summary; text model ingested visual description and discussed character appearance seamlessly.
4. **Client Production Build**:
   - `bun run build` completed cleanly in 11.47s with zero TypeScript or Vite errors.
