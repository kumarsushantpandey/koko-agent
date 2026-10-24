# Free.ai Multi-Provider LLM & Streamlined Settings Specification & Learnings

## 1. Overview & Objective

This document formalizes the architectural learnings, endpoint discoveries, protocol designs, and interface decisions made during the integration of **Free.ai** as a secondary LLM provider and the creation of the dedicated **Settings Page** in the Akari Watanabe AI assistant.

Reference Codebase Links:
- `./server/src/llm/freeai_model.py`
- `./server/src/llm/mistral_model.py`
- `./server/src/llm/provider.py`
- `./client/src/components/screens/SettingsScreen.tsx`
- `./client/src/components/screens/SettingsScreen.css`
- `./client/src/navigation/useNavigation.ts`
- `./docx/context/2026-09-26.md`

---

## 2. Free.ai API Mechanics & Endpoint Discoveries

### 2.1 The Dual-Endpoint Trap (`/v1/chat/completions` vs `/v1/chat/`)
Standard OpenAI SDK integrations default to POSTing to `{base_url}/chat/completions`. However, Free.ai operates with distinct endpoint semantics:

1. **`POST https://api.free.ai/v1/chat/completions` (OpenAI Compatibility Route)**:
   - Primarily serves **self-hosted** open-weights models (`qwen7b`, `qwen3-8b`, `mistral`, `deepseek-r1`).
   - When requested with external or premium models (e.g., `qwen/qwen3.6-35b-a3b`), it throws:
     ```json
     400 {"error":"'qwen/qwen3.6-35b-a3b' is not served by this endpoint. Self-hosted chat here: qwen7b, qwen3-8b. Premium external models run on POST /v1/chat/ instead."}
     ```

2. **`POST https://api.free.ai/v1/chat/` (Official Universal Route)**:
   - Officially documented in Free.ai documentation (`https://free.ai/api/` and `https://free.ai/models/qwen-qwen3-6-35b-a3b/`).
   - Universally supports **both** self-hosted models (`qwen7b`, `qwen3-8b`, `deepseek-r1`, `mistral`) AND external/frontier models (`qwen/qwen3.6-35b-a3b`).
   - **Learning**: Implementing client requests via `httpx.stream("POST", f"{base_url}/chat/", ...)` bypasses SDK routing limitations and ensures compatibility across all present and future Free.ai models.

### 2.2 Server-Sent Events (SSE) Streaming Format
Free.ai streams tokens using standard `data: ` SSE frames ending with `data: [DONE]`:
```http
data: {"id":"chatcmpl-...","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"}}]}
...
data: [DONE]
```
In `./server/src/llm/freeai_model.py`, streaming is parsed directly from `resp.iter_lines()`, yielding deltas into the dialogue chunker queue in real-time.

### 2.3 Token Billing & Premium Quota Handling
- **Daily Free Pool**: Accounts receive 30,000 tokens/day for self-hosted models (`qwen7b`, `qwen3-8b`, `mistral`, `deepseek-r1`).
- **Quota Depletion Status Codes**:
  - `Status 402 {"error":"No tokens remaining..."}`: Emitted when an account's API key exhausts its daily token allowance.
  - `Status 429 {"error":"Daily limit reached"}`: Emitted when an unauthenticated/anonymous IP exceeds its daily requests.
- **External Frontier Models**: Models like `qwen/qwen3.6-35b-a3b` utilize paid upstream providers and require token balance. If invoked without purchased credits, the endpoint returns a `429 premium_requires_purchase` status.
- **Defensive Error Handling**: Instead of throwing unhandled exceptions that break the WebSocket loop, `./server/src/llm/freeai_model.py` intercepts non-200 responses and yields a user-facing explanation (`[Free.ai Error: ...]`).

### 2.4 Function Calling / Tool Calling Mechanics on Free.ai
1. **OpenAI SDK Route (`POST /v1/chat/completions`)**:
   - Native JSON schema function calling is supported on self-hosted models (`qwen7b`, `qwen3-8b`).
   - **`tool_choice="auto"` Requirement**: Must be explicitly supplied in `client.chat.completions.create()`. Without it, vLLM's chat template may default to `none` or fail to emit tool calling tokens for roleplay prompts.
   - **Temperature Tuning**: Set `temperature=0.7` for tool-decision phases. A high temperature (e.g. `0.9`) encourages 7B models to emit conversational excuses (*"Wait a sec, I'll check..."*) instead of function calls.
   - **Intermediate Filler Suppression**: When the model outputs both content chunks and a tool call in round 1, intermediate speech must be suppressed from TTS and subtitles. Only the round 2 response incorporating actual tool results is vocalized.
   - **Finish Reason Agnosticism**: Break conditions must inspect `if not tool_calls_dict: break` rather than strictly checking `finish_reason == "tool_calls"`, as gateways can stream tool call deltas while concluding with `finish_reason: "stop"` or `None`.
   - **Fallback Streaming**: If all tools are disabled or tool definitions are empty, the handler automatically falls back to standard SSE streaming.

---

## 3. Supported Model Matrix

| Provider | Model ID | Display Name | Category | Context Window |
| :--- | :--- | :--- | :--- | :--- |
| **Mistral AI** | `ministral-8b-latest` | Ministral 8B | Default Edge | 128k |
| **Mistral AI** | `mistral-small-latest` | Mistral Small | Reasoning | 32k |
| **Mistral AI** | `open-mistral-7b` | Open Mistral 7B | Baseline | 32k |
| **Free.ai** | `qwen7b` | Qwen 2.5 7B | Recommended Free | 32k |
| **Free.ai** | `qwen3-8b` | Qwen 3 8B | Instruction Tuned | 32k |
| **Free.ai** | `mistral` | Mistral 7B | Fast Inference | 32k |
| **Free.ai** | `deepseek-r1` | DeepSeek R1 Distill | Chain of Thought | 64k |

---

## 4. Settings UI Design Learnings & Anti-Bloat Strategy

### 4.1 De-bloating the Settings Interface
Initial prototypes placed large marketing cards with paragraphs of explanatory copy and multi-column grids onto the Settings page. This caused visual fatigue and unnecessary scrolling.
- **Segmented Control for Providers**: Replaced bulky 2-column cards with a slim, high-contrast segmented button group (`.provider-segment-group`) with active emerald status dots.
- **Compact Model Rows**: Replaced large cards with minimal, single-line horizontal rows (`.compact-model-row`) highlighting model display name, context tag, badge, and monospace ID.
- **Slim URL Sync Bar**: Compacted URL synchronization and copy functionality into a streamlined single-row pill (`.slim-sync-bar`).

### 4.2 Scroll Clearance & Bottom Margin Ergonomics
When a view scrolls within an absolute overlay container (`overflow-y: auto`), placing the last element at the bottom without explicit clearance leads to visual clipping against the window edge:
- **Solution**: Implemented `.settings-bottom-spacer { height: 80px; width: 100%; flex-shrink: 0; }` and container padding `padding: 36px 24px 0 24px;` in `./client/src/components/screens/SettingsScreen.css`.
- This ensures 80px of comfortable breathing room when scrolled to the bottom.

### 4.3 3D VRM Canvas Unmounting on Settings Screen
In `./client/src/App.tsx`:
```tsx
{screen !== "settings" && <Canvas ...>...</Canvas>}
{screen !== "settings" && <SubtitleOverlay ... />}
```
Unmounting Three.js / WebGL rendering during settings:
1. Keeps CPU/GPU utilization near zero while configuring settings.
2. Centers focus entirely on settings configuration.
3. Restores full avatar state and animation when returning to characters, chat, stream, or gallery.

---

## 5. URL Parameter Synchronization Protocol

### 5.1 Bi-directional State Sync
The application guarantees that the URL search parameters always represent the active application state:
```
/?screen=settings&character=akari&provider=freeai&model=qwen/qwen3.6-35b-a3b
```
1. **Initial Mount**: `useNavigation.ts` reads `window.location.search`. If `&provider` or `&model` are absent, it seeds them from `localStorage` or defaults and runs `window.history.replaceState`.
2. **User Interaction**: Selecting a model triggers `updateLlm(provider, model)`, updating:
   - React state `navState`
   - Browser URL via `replaceState`
   - `localStorage` (`akari_llm_provider`, `akari_llm_model`)
   - WebSocket backend via `avatarSocket.setLlmProvider(provider, model)`
3. **Screen Switching**: When navigating between screens (e.g. Settings -> Characters -> Chat), `navigate(targetScreen)` preserves the active `provider` and `model` parameters in the URL.

---

## 6. Model Validation, Fallback Traps & Live Execution Guarantees

### 6.1 The Silent Fallback Trap
A critical issue was identified where setting a custom, experimental, or invalid model name (e.g. `model=rubbish`) still resulted in a successful response. Investigation revealed:
1. **Model Filtering Guard in `provider.py`**:
   `if model_id and any(m["id"] == model_id for m in matched["models"]): _active_model = model_id else: _active_model = matched["default_model"]`
   Because `rubbish` was not in `matched["models"]`, the backend silently discarded it and reverted to `default_model` (`ministral-8b-latest` / `qwen7b`).
2. **Early Connection Drop**:
   `setLlmProvider()` sent during page mount while the WebSocket was still `CONNECTING` was lost because `readyState !== WebSocket.OPEN`.
3. **Missing Message Parameters**:
   `ChatInput.tsx` sent `{ type: "chat_message", text: "..." }` without attaching `provider` and `model`.

### 6.2 The Three-Tier Execution Guarantee
To guarantee that the exact model selected by the user is executed:
1. **Unfiltered Model Acceptance in `provider.py`**:
   `_active_model = model_id.strip()` is applied unconditionally. The backend never silently reverts to default if the user specified a model.
2. **Connection Resend Queue in `AvatarSocket.ts`**:
   `pendingLlmProvider` is persisted and re-sent immediately in `socket.onopen`.
3. **Per-Message Model Binding**:
   Every `chat_message` sent from `ChatInput.tsx` carries `{ provider, model }`. In `websocket_server.py`, `_handle_chat_message()` synchronizes `set_active_provider(provider, model)` before executing the stream.
4. **Upstream API Validation Feedback**:
   If an invalid model (e.g. `rubbish_test_123`) is queried, Mistral returns `Status 400: Invalid model: rubbish_test_123` and Free.ai returns `Status 400: not a chat model`. This error is captured and displayed directly in subtitles and console, providing 100% transparency.

