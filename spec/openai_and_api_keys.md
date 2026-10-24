# OpenAI GPT Integration & Dynamic API Key Architecture Specification

**Status**: Active  
**Date**: 2026-09-29  
**Components**: `./server/src/llm/openai_model.py`, `./server/src/llm/provider.py`, `./server/src/llm/vision.py`, `./server/src/bridge/websocket_server.py`, `./client/src/components/screens/SettingsScreen.tsx`, `./client/src/components/screens/SettingsScreen.css`, `./client/src/networking/AvatarSocket.ts`, `./client/src/networking/types.ts`

---

## 1. Executive Summary

This specification defines the integration of OpenAI as a first-class inference provider for the Akari Watanabe AI application, alongside a dynamic, privacy-conscious **Client-to-Server API Key Management System**.

Users can select OpenAI in the Settings screen, configure their personal API key directly from the browser UI with instant validation, and converse with flagship GPT models (`gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo`) with full support for:
- Low-latency SSE token streaming
- Multi-round autonomous tool calling (function calling)
- Native multimodal vision perception for attached images
- Synchronized facial emotions and speech lip-syncing

---

## 2. Dynamic API Key Architecture

### 2.1 Privacy & Storage Model
1. **Local Browser Persistence**: The user's OpenAI API key is stored in browser `localStorage` under `akari_openai_api_key`.
2. **Session Synchronization**: When the WebSocket connects (or when the user clicks "Save & Use Key" in Settings), the key is transmitted directly to the local backend process via `{ type: "set_api_key", provider: "openai", api_key: "sk-..." }`.
3. **No External Telemetry**: The key is kept strictly in-memory within the server process (`_runtime_api_key`) and only used to authenticate requests directly against OpenAI endpoints (`https://api.openai.com/v1`).
4. **Environment Fallback**: If no runtime key is provided by the client, the server seamlessly falls back to `OPENAI_API_KEY` defined in `./server/.env`.

### 2.2 WebSocket Protocol Extension

#### Client to Server: `set_api_key`
```json
{
  "type": "set_api_key",
  "provider": "openai",
  "api_key": "sk-proj-..."
}
```

#### Server to Client: `config` Broadcast
Announces whether API keys are currently configured across providers:
```json
{
  "type": "config",
  "chat_input_enabled": true,
  "llm_provider": "openai",
  "llm_model": "gpt-4o-mini",
  "tool_calling_enabled": true,
  "tool_calling_supported": true,
  "vision_supported": true,
  "api_keys_configured": {
    "openai": true,
    "mistral": true,
    "freeai": true,
    "openrouter": true
  }
}
```

---

## 3. Model Capability Matrix

| Model ID | Display Name | Context Window | Tool Calling | Vision Native | Recommended Use |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `gpt-4o-mini` | GPT-4o Mini | 128k tokens | **Yes** | **Yes** | **Default / Recommended** (Fast, cost-efficient, high quality) |
| `gpt-4o` | GPT-4o | 128k tokens | **Yes** | **Yes** | Flagship multimodal reasoning & nuance |
| `gpt-4-turbo` | GPT-4 Turbo | 128k tokens | **Yes** | **Yes** | Frontier reasoning & complex tool execution |
| `gpt-3.5-turbo` | GPT-3.5 Turbo | 16k tokens | **Yes** | No (Hybrid fallback) | Legacy, low-overhead text generation |

---

## 4. Backend Implementation (`./server/src/llm/openai_model.py`)

### 4.1 Native Multimodal Message Formatting
Images attached by the user are converted into standard OpenAI vision content blocks:
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

### 4.2 Autonomous Tool Calling Loop
When `tools_enabled=True`:
1. Submits tool definitions from `tool_registry.get_tool_definitions()`.
2. Assembles chunked tool calls (`delta.tool_calls`) across streaming deltas.
3. If tool calls are requested, executes each tool asynchronously via `tool_registry.execute_tool()`.
4. Dispatches live `on_tool_activity(name, "start" | "end")` events to animate UI badges.
5. Appends assistant and tool response messages, looping up to `max_tool_rounds` (default: 5) until conversational text is generated.

### 4.3 Graceful Error Handling
If a user switches to OpenAI without configuring an API key, the stream generator cleanly yields a friendly prompt:
```text
[OpenAI Notice: Please enter your OpenAI API key in Settings -> OpenAI to use GPT models.]
```
Preventing server crashes or uncaught HTTP 401 exceptions.

---

## 5. UI/UX Design System (`./client/src/components/screens/SettingsScreen.tsx`)

1. **Segmented Provider Selector**: 2x2 responsive grid featuring Mistral AI, OpenAI, Free.ai, and OpenRouter.
2. **Interactive API Key Card**:
   - Monospace input box with custom padding and show/hide password toggle (`IconEye` / `IconEyeOff`).
   - "Save & Use Key" button with linear purple gradient and smooth checkmark state transition upon synchronization.
   - Status badge: Emerald `Key Active` dot when authenticated; Amber `Key Required` when empty.
   - One-click "Clear Key" button.
   - Informative privacy guarantee explaining local browser storage.

---

## 6. Direct Multimodal Vision Architecture

OpenAI natively supports direct image inputs (`gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`):
- **Bypasses Secondary Vision**: When OpenAI is active, the system never invokes external OCR/vision feature extractors (`analyze_image`).
- **Direct Image Transmission**: The image Data URI is passed directly into `stream_chat(prompt, history, image=pass_image)`, formatting the user content as:
  ```json
  [
    {"type": "text", "text": "user message or prompt"},
    {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
  ]
  ```
- **Context Retention**: When tool calling executes over multiple loops, the image user message remains intact in the prompt context history.

---

## 7. Streamlined URL Synchronization & Storage Schema

To ensure clean, shareable URLs:
1. **Omit `provider` from URL**: Provider is inferred dynamically from `model` (e.g. `gpt-*` -> `openai`, `openrouter/*` -> `openrouter`, `mistral*` -> `mistral`, `qwen*` -> `freeai`), or read from `localStorage.getItem("akari_llm_provider")`.
2. **Model-Only Query String**: Only `model` is retained in the URL along with core routing params:
   `/?screen=settings&character=akari&model=gpt-4o-mini`
3. **Tool Calling Exclusively in LocalStorage**: Tool calling status is omitted from the URL and stored strictly under `localStorage.getItem("akari_tool_calling_enabled")` (default: `true`).
4. **Canonical Cleansing**: On initial mount, legacy query parameters (`&provider=...`, `&tools=...`) are stripped via `window.history.replaceState`.
