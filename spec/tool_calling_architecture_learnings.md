# Tool Calling Architecture, Model Capability Matrix & Streaming Integration Specification
**Date**: September 26, 2026  
**Repository**: `Lakshyakumar266/Ai-Akari-Watanabe` (`AiAkari`)  
**Feature**: Tool Calling / Function Calling Capability Subsystem  
    
---

## 1. Overview & Objective

This specification formalizes the architecture, discovery patterns, provider compatibility matrix, execution mechanics, and user interface controls implemented for the **Tool Calling** (Function Calling) feature in Akari Watanabe .

Reference Codebase Links:
- `./server/src/tools/base.py`
- `./server/src/tools/builtins.py`
- `./server/src/tools/registry.py`
- `./server/src/tools/__init__.py`
- `./server/src/llm/mistral_model.py`
- `./server/src/llm/freeai_model.py`
- `./server/src/llm/provider.py`
- `./server/src/chat/loop.py`
- `./server/src/bridge/websocket_server.py`
- `./server/src/bridge/events.py`
- `./client/src/components/screens/SettingsScreen.tsx`
- `./client/src/components/screens/SettingsScreen.css`
- `./client/src/components/ChatInput.tsx`
- `./client/src/components/ChatInput.css`
- `./client/src/navigation/useNavigation.ts`
- `./client/src/networking/AvatarSocket.ts`
- `./client/src/networking/types.ts`
- `./docs/plans/tool-calling-02.md`

---

## 2. End-to-End Pipeline & Execution Lifecycle

Instead of treating tool results as spoken dialog or robotic JSON output, Akari employs a **Two-Stage Conversational Loop**:

```text
User Message (Browser UI)
    ↓
Check: Is Tool Calling Enabled & Supported?
    ├── NO  → Standard Low-Latency Token Stream → Dialogue Chunker → TTS → VRM
    └── YES → Stage 1: Tool Decision & Execution Loop
                   ↓
              Model requests tool_call (e.g. get_current_time)
                   ↓
              Broadcast `tool_start` → UI shows "Checking current time..."
                   ↓
              Tool Registry executes function safely with timeout
                   ↓
              Broadcast `tool_end` → Append ToolMessage to conversation
                   ↓
              Can model repeat? (Up to MAX_TOOL_CALL_ROUNDS=5)
                   ↓
              Stage 2: Final Natural Response Generation
                   ↓
              Emits Tsundere response with emotion tag (e.g. [happy], [neutral])
                   ↓
              Dialogue Chunker (. ! ? or 16 words)
                   ↓
              TTS Engine (Fish Audio / GPT-SoVITS WAV bytes)
                   ↓
              AudioPlayer (Web Audio API) + LipSyncController (RMS 60fps) + VRM expressions
```

### Critical Behavioral Guarantees
1. **No Robotic Tool Speech**: Raw tool JSON payloads and internal function names are strictly isolated from the TTS synthesizer and subtitle rendering. Only the final conversational response is vocalized.
2. **Zero Hallucination Grounding**: If the model needs real-time context (such as time, date, or system status), it relies on verified tool outputs. If a tool fails or times out, the error is passed back to the model context so Akari explains naturally rather than inventing false facts.
3. **Persona Preservation**: Akari retains her Tsundere gyaru personality throughout:
   - Example user prompt: *"What time is it?"*
   - Model tool execution: `get_current_time` $\to$ `{"time_12h": "4:41 PM", ...}`
   - Akari response: `"[neutral] Ugh, four forty-one? Already? I swear, time just flies when I'm around you. You should probably stop wasting time and do something useful..."`

---

## 3. Provider & Model Capability Matrix

Tool calling is treated as a **first-class capability flag** at both provider and individual model levels. The application does not assume all models support function calling.

| Provider | Model ID | Tool Calling Supported | Technical Notes |
| :--- | :--- | :---: | :--- |
| **Mistral AI** | `ministral-8b-latest` | **Yes** | Full native JSON schema function calling via official Mistral SDK (`mistralai>=2.8.0`). Default model. |
| **Mistral AI** | `mistral-small-latest` | **Yes** | Large context reasoning with tool calling support. |
| **Mistral AI** | `open-mistral-7b` | **Yes** | Mistral 7B open weights with function calling support. |
| **Free.ai** | `qwen7b` | **Yes** | Qwen 2.5 7B natively parses OpenAI-compatible `tools` array. Free gateway tier. |
| **Free.ai** | `qwen3-8b` | **Yes** | Qwen 3 8B instruction-tuned model supporting function calling. |
| **Free.ai** | `mistral` | **No** | Endpoint on gateway does not serve function calling endpoints for this alias. |
| **Free.ai** | `deepseek-r1` | **No** | Reasoning / Chain of Thought model; does not support function calling on this endpoint. |

### Settings UI Model-Switching Guarantee
When switching between models in `./client/src/components/screens/SettingsScreen.tsx`:
- Selecting a model with `toolCallingSupported: false` immediately disables the tool toggle and sets the badge to **Model Unsupported**.
- The backend WebSocket server validates every request in `./server/src/bridge/websocket_server.py`; even if a client attempts to forge a `set_tool_calling` payload with an incompatible model, the server rejects it and keeps tools disabled.

---

## 4. Built-in Tools Specification (`./server/src/tools/`)

All tools are strictly allowlisted and execute in an asynchronous, non-blocking thread pool with timeout bounds.

### 4.1 Tool 1: `get_current_time`
- **Identifier**: `get_current_time`
- **Display Name**: Current Time
- **Description**: Returns current time and date for any city, country, or timezone worldwide (e.g. Tokyo, London, New York, Paris, India, PST, UTC). Defaults to user's local time if omitted.
- **Parameters**:
  - `location` (optional string): Target city, country, or timezone name.
  - `timezone` (optional string): Target timezone code or IANA identifier.
- **Output Sample**:
  ```json
  {
    "status": "success",
    "location": "Tokyo",
    "time_12h": "8:30 PM",
    "time_24h": "20:30:45",
    "date": "Saturday, September 26, 2026",
    "timezone_name": "JST",
    "utc_offset": "UTC+09:00",
    "is_morning": false,
    "is_evening": true
  }
  ```

### 4.2 Tool 2: `get_timezone_info`
- **Identifier**: `get_timezone_info`
- **Display Name**: Timezone Details
- **Description**: Returns detailed timezone metadata including IANA timezone code, UTC offset (e.g. UTC+05:30), daylight saving status, and current time for any location or user's local timezone.
- **Parameters**: `location` (optional string).

### 4.3 Tool 3: `convert_time`
- **Identifier**: `convert_time`
- **Display Name**: Timezone Converter
- **Description**: Converts a specific time from one timezone/city to another (e.g. '3:00 PM' from 'New York' to 'Tokyo'). Handles day offsets and time differences without hallucination.
- **Parameters**:
  - `time_str` (string, required): e.g. "3:00 PM", "15:30", "noon".
  - `from_location` (string, required): Source location.
  - `to_location` (string, required): Destination location.
  - `date_str` (optional string): Reference date.

### 4.4 Tool 4: `time_difference`
- **Identifier**: `time_difference`
- **Display Name**: Time Difference
- **Description**: Calculates exact current time difference and compares time between two cities, countries, or timezones.
- **Parameters**: `location_a` (string, required), `location_b` (string, required).

### 4.5 Tool 5: `get_current_date`
- **Identifier**: `get_current_date`
- **Display Name**: Current Date
- **Description**: Returns current calendar date, day of the week, month, year, and day of the year for any timezone.
- **Parameters**: `location` (optional string).

### 4.6 Tool 6: `get_day_of_week`
- **Identifier**: `get_day_of_week`
- **Display Name**: Day of Week
- **Description**: Calculates the weekday, formatted calendar date, and days relative to today for any past, present, or future date.
- **Parameters**: `date_str` (string, required), `location` (optional string).

### 4.7 Tool 7: `calculate`
- **Identifier**: `calculate`
- **Display Name**: Calculator
- **Description**: Safe AST mathematical expression evaluator for arithmetic, percentages (`25% of 400`), powers, and functions (`sqrt`, `abs`, `round`, `sin`, `cos`). Strictly avoids unsafe Python `eval()`.
- **Parameters**: `expression` (string, required).

### 4.8 Tool 8: `get_system_status`
- **Identifier**: `get_system_status`
- **Display Name**: System Status
- **Description**: Returns host OS environment, Python runtime version, active AI model, detected client timezone, and health metrics.
- **Parameters**: `{ "type": "object", "properties": {}, "required": [] }`

---

## 5. Streaming Mechanics with Tool Calling

### 5.1 Mistral Client Streaming Loop
In `./server/src/llm/mistral_model.py`:
1. The stream is initiated with `client.chat.stream(model=active_model, messages=messages, tools=tools)`.
2. As chunks arrive, `choice.delta.tool_calls` chunks are checked:
   - If present, tool IDs, function names, and JSON argument fragments are collected in an in-memory dictionary.
   - If normal text tokens (`choice.delta.content`) arrive instead, they are immediately yielded to downstream dialogue chunkers without delay.
3. When `finish_reason == "tool_calls"`:
   - Tool arguments are parsed and executed via `./server/src/tools/registry.py`.
   - `AssistantMessage(content="", tool_calls=...)` and `ToolMessage(tool_call_id=..., name=..., content=...)` are appended to the conversation history.
   - The loop iterates (bounded by `max_tool_rounds=5`) to allow the model to either request additional tools or stream the final answer.

### 5.2 Free.ai OpenAI-Compatible Client Streaming Loop
In `./server/src/llm/freeai_model.py`:
1. **Tool Invocation Directives**:
   - Must supply `tool_choice="auto"` and `temperature=0.7`.
   - Without `tool_choice="auto"`, vLLM may default to `none` or skip emitting tool call tokens for roleplay personas.
2. **Intermediate Pre-Tool Content Isolation**:
   - When Qwen 7B or similar instruction-tuned models emit conversational excuses (*"Wait a sec, I'll check..."*) in round 1 alongside a tool call, this text is buffered in `round_content_chunks`.
   - If `tool_calls_dict` is non-empty, intermediate filler text is **suppressed** from downstream TTS synthesis and subtitle dispatching. Only round 2's grounded response incorporating the tool result is vocalized to the user.
   - The assistant message appended to history retains `content="".join(round_content_chunks)` to maintain full OpenAI schema compliance.
3. **Finish-Reason Agnosticism**:
   - The loop inspects `if not tool_calls_dict: break` rather than demanding `finish_reason == "tool_calls"`. This ensures tool calls are executed even if gateways conclude frames with `finish_reason: "stop"` or `None`.
4. **Fallback Streaming**:
   - If all tools are disabled or tool definitions are empty, the handler automatically falls back to universal SSE direct streaming (`/v1/chat/`).

### 5.3 Multi-Tool Execution in a Single Turn
The model can invoke multiple tools either in parallel or sequentially. For example, for the query *"What is today's date and what time is it?"*, the model invokes both `get_current_date` and `get_current_time` in round 1, then synthesizes both results in round 2:
```text
Round 1: [Tool: get_current_date] → Saturday, September 26, 2026
Round 1: [Tool: get_current_time] → 4:41 PM
Round 2: [happy] Ooooh, Saturday already? That means we have all day to hang out, right? It's 4:41 PM now...
```

---

## 6. Interrupt & Stop Handling

If the user clicks **Stop** in `./client/src/components/ChatInput.tsx` while a tool is being evaluated or executed:
1. Client sends binary packet `0x03` (`AUDIO_INTERRUPT`) and JSON `{"type": "interrupt"}`.
2. `stop_chat_stream()` in `./server/src/chat/loop.py` triggers `cancel_event.set()` (a thread-safe `threading.Event`).
3. Both `mistral_model.py` and `freeai_model.py` check `cancel_event.is_set()` before and after every tool execution and token chunk.
4. Any active tool task or LLM stream terminates immediately, cleaning up audio queues and returning the UI to idle state.

---

## 7. Frontend Settings UI & URL Synchronization

### 7.1 Settings Screen Controls (`./client/src/components/screens/SettingsScreen.tsx`)
1. **Master Toggle**:
   - High-contrast glassmorphic toggle with ON/OFF indicator.
   - Disabled and dimmed when an unsupported model is active.
2. **Capability Badge**:
   - `MODEL SUPPORTED` (emerald glow) or `MODEL UNSUPPORTED` (amber/ruby warning).
3. **Available Tools Grid**:
   - Visual cards for `Current Time`, `Current Date`, and `System Status`.
   - Cards switch from `Dormant` to `Ready` when tool calling is enabled.
4. **URL Synchronization**:
   - Synchronizes state to URL parameter: `&tools=true` or `&tools=false`.
   - Restores state on browser reload or link sharing.
   - Persists state in `localStorage("akari_tool_calling_enabled")`.

### 7.2 Real-Time Tool Activity Feedback (`./client/src/components/ChatInput.tsx`)
When a tool is invoked by Akari, the server dispatches `{"type": "tool_start", "tool": "get_current_time"}`. The chat input displays an animated status pill:
```text
[ ● Checking current time… ]
```
When tool execution concludes, `tool_end` clears the status pill smoothly as spoken audio begins.

---

## 8. Key Architectural Learnings & Hardening

1. **Windows Python `zoneinfo` Dependency (`tzdata`)**:
   - Python's standard `zoneinfo` module relies on the system timezone database. On Linux/macOS, `/usr/share/zoneinfo` is provided by the OS. On Windows, Python raises `ModuleNotFoundError: No module named 'tzdata'` unless the `tzdata` package is installed. Adding `tzdata` to `pyproject.toml` guarantees reliable cross-platform timezone loading.
2. **Client-Driven Timezone Context Injection**:
   - Because the backend server may run locally, in a remote Docker container, or in the cloud, resolving "local time" by server system clock alone causes discrepancies if the user is in a different timezone. The browser resolves its exact IANA timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) and dispatches it in each `chat_message` over WebSocket. The backend sets client context so queries like *"what time is it in my timezone?"* or *"what is the time here?"* always match the user's physical environment.
3. **Safe AST Evaluation vs. Arbitrary Code Execution**:
   - For mathematical calculations, LLMs frequently make simple arithmetic and percentage calculation errors. Rather than invoking dangerous Python `eval()` or `exec()`, the `calculate` tool uses Python's `ast` parser to strictly evaluate mathematical expression nodes with safe operators and white-listed math functions.
4. **Unbloated Prompt Design via API Schemas**:
   - Manually enumerating all tool signatures, argument definitions, and descriptions inside the system prompt causes prompt bloat, increases input token costs, and creates synchronization drift when tools change. Modern models (Mistral, Qwen, OpenAI) receive the exact JSON schema in the API `tools` array.
5. **Small-Model Attention Overload & Tool Schema Disambiguation**:
   - Smaller 7B-parameter models (such as Qwen 2.5 7B) exhibit attention degradation when presented with too many overlapping tools (e.g. 5 different time tools: `get_current_time`, `get_timezone_info`, `convert_time`, `time_difference`, `get_current_date`). In benchmarking, passing 1–3 distinct tools triggered function calling 100% of the time, whereas 9 overlapping tools caused the model to hesitate and output conversational excuses (*"I'll check..."*).
   - Setting `get_available_tools` to `enabled=False` by default avoids redundant schema pollution (since the model already receives all enabled tools in the API request).
   - Tool descriptions must be kept crisp, distinct, and unambiguous so smaller models can easily route user requests without hesitation.

---

## 9. Unbloated System Prompt & Dynamic Tool Discovery Architecture

### 9.1 The Bloat Anti-Pattern
Listing every tool with its parameters, types, and descriptions in the `SYSTEM_PROMPT` creates duplicate schema overhead:
```text
System Prompt (Bloated: ~350 tokens) ──► Explains get_current_time, get_timezone_info, etc.
API `tools` parameter (Native JSON)  ──► Explains get_current_time, get_timezone_info, etc.
```

### 9.2 The Clean Architecture Pattern
1. **Lean System Prompt** (`./server/src/prompts/system_prompt_akari.py`):
   ```text
   REAL-TIME TOOLS & USER CONTEXT:
   - You have real-time access to external tools via native function calling.
   - When {{user}} asks about the current time or date without specifying another city, always report {{user}}'s local time and date by default.
   - Never guess or hallucinate real-time facts, timezones, or math calculations; always invoke the appropriate tool.
   - You can call get_available_tools at any time to inspect all available tools and capabilities.
   - After receiving tool results, respond naturally in your Tsundere gyaru persona using the 6 allowed emotion tags. Never recite raw JSON, function names, or code.
   ```
2. **Dynamic Tool Discovery (`get_available_tools`)**:
   - If the user or model ever queries *"What can you do?"* or *"What tools do you have?"*, the model invokes `get_available_tools()`.
   - The tool dynamically inspects the active catalog in `./server/src/tools/builtins.py` and returns names, display titles, and summaries in real-time.

---

## 10. Understanding `max_rounds per turn` (Safety Guardrail)

### 10.1 What is `max_rounds`?
In conversational tool calling, a single user message ("turn") can trigger **multiple sequential tool rounds**:
```text
Turn Start (User: "What's the time in Tokyo, and how many hours is it ahead of London?")
   Round 1: Model calls get_current_time(location="Tokyo")
   Round 1 Output: {"time": "8:40 PM", "utc_offset": "+09:00"}
   Round 2: Model calls time_difference(location_a="London", location_b="Tokyo")
   Round 2 Output: {"difference_hours": 8.0}
   Round 3: Model synthesizes both results and outputs spoken response.
Turn Complete.
```

### 10.2 Why is it Necessary?
1. **Runaway / Infinite Loop Prevention**: Without a bound, a confused or hallucinating model could invoke tools in an infinite loop (`get_current_time` $\to$ `get_current_time` $\to$ ...), consuming infinite API credits and hanging the user's audio output.
2. **Bound Enforcement**:
   - Configured in `./server/src/config.py`: `MAX_TOOL_CALL_ROUNDS = 5`.
   - When the round counter reaches 5, the tool loop halts and forces the model to synthesize a conversational answer with the data collected so far.
   - If an error occurs, it is returned cleanly within the iteration bounds.

---

## 11. Default User Location-Specific Time & Date Resolution

### 11.1 Behavioral Rule
Whenever {{user}} asks:
- *"What time is it?"*
- *"What's the date today?"*
- *"What day is it?"*
- *"What is my timezone?"*

Without specifying an external city or country, the system **strictly defaults to the user's location**:
1. Client browser resolves `Intl.DateTimeFormat().resolvedOptions().timeZone` (e.g. `Asia/Kolkata`).
2. Client sends `timezone` in `chat_message` over WebSocket.
3. Backend records client context via `set_client_timezone()`.
4. `get_current_time()` and `get_current_date()` detect that no location was requested, resolve against the user's IANA timezone, and tag the response with:
   - `"is_user_local_time": true`
   - `"location": "User's Local Time (Kolkata, Asia)"`
   - `"instruction": "This is the user's specific local time and date. Answer with this time directly."`
5. Akari speaks the exact local time directly without claiming she is in a different timezone or assuming Tokyo/UTC.


---

## 12. Web Search & AI Crawler Integration (Tavily & DuckDuckGo)

### 12.1 Objective & Capability
To enable Akari to answer live real-world queries (current events, anime news, weather, facts, website content) without hallucination, the system implements a unified `web_search` tool adhering to the official **Tavily Agent Setup Specification** (`tavily.com/agent-setup/SKILL.md`):

```text
User asks: "What anime is Akari Watanabe from?" or "Latest news in Tokyo"
                    ↓
        Invoke `web_search(query)`
                    ↓
   Tier 1: TAVILY_API_KEY present?
       ├── YES → `tavily-python` SDK / REST API (Basic search + synthesized AI answer)
       └── NO  → Tier 2: Tavily Keyless Mode (`X-Tavily-Access-Mode: keyless`)
                    ↓
            Tier 2 Success?
       ├── YES → Returns Tavily AI summary and top web results
       └── NO  → Tier 3: DuckDuckGo fallback (`ddgs` / `duckduckgo_search`)
                    ↓
        Model receives clean JSON with `ai_summary` and `results`
                    ↓
        Synthesizes natural Tsundere gyaru response
```

### 12.2 Multi-Tier Search Engine Hierarchy
1. **Tier 1 — Authenticated Tavily AI Crawler**:
   - Uses the official `tavily-python` client with `search_depth="basic"`, `include_answer=True`, and `max_results=3`.
   - Returns a structured AI summary answering the user's prompt directly, accompanied by verified source URLs and content snippets.
2. **Tier 2 — Tavily Keyless Access**:
   - Following `tavily.com/agent-setup/SKILL.md` Path E:
     Sends header `X-Tavily-Access-Mode: keyless` to `https://api.tavily.com/search`.
   - Allows zero-config Tavily AI Search and Answer synthesis out-of-the-box before the user configures an explicit API key.
3. **Tier 3 — DuckDuckGo Local Scraper**:
   - Uses `ddgs` (with `duckduckgo_search` fallback) to retrieve top search results without requiring an external API key or network authorization.

---

## 13. Conversation Compaction Architecture (Summary Buffer Memory)

### 13.1 Problem Statement
In extended voice and chat sessions, unbounded history growth creates two major failure modes:
1. **Excessive Token Consumption & Latency**: Sending 30+ conversation turns causes high token usage, slower first-token latency, and higher costs.
2. **Loss of Contextual Cohesion**: Older dialogue overwhelms the model's immediate context window.

### 13.2 Threshold-Gated Compaction Subsystem (`server/src/llm/compactor.py`)
Following production patterns established by LangChain (`ConversationSummaryBufferMemory`), OpenAI Assistants, and MemGPT:

```text
Turn Completed (UserMessage + AssistantMessage appended)
                    ↓
       Check `should_compact(history)`
       ├── NO (< 16 messages and < 8,000 chars) → Return history unchanged (0 overhead)
       └── YES (History is too big)
                    ↓
           Partition History:
           - older_messages: all turns except last `keep_recent=6`
           - recent_messages: untouched last 6 messages
                    ↓
           LLM Summarization Call (`provider.classic_chat`):
           "Summarize transcript into dense factual memory: facts, preferences, topics, emotions."
                    ↓
           Replace older messages with structured Memory Context turn:
           [UserMessage("[Context from earlier conversation:\n<summary>\n(Background memory)]")]
           [AssistantMessage("[Understood, I remember everything we talked about.]")]
           + recent_messages
```

### 13.3 Performance Characteristics
- **Zero Overhead on Normal Turns**: The loop only invokes compaction when history surpasses the threshold. Turns 1–7 incur zero extra calls or latency.
- **Immediate Flow Preservation**: Because `keep_recent=6` messages are preserved verbatim, immediate pronoun resolution (*"why did you say that?"*, *"tell me more about it"*) and recent tool returns are never lost.
- **Fail-Safe Fallback**: If the summarization model call times out or encounters network errors, the compactor drops into a sliding-window truncation fallback so the conversation turn never fails.

---

## 14. Responsive 2-Column Grid & Container Containment

### 14.1 UI Layout Hardening (`SettingsScreen.css`)
- Replaced the inflexible `repeat(3, 1fr)` grid with `repeat(2, minmax(0, 1fr))`, with a responsive breakpoint collapsing to `1fr` on screens $\le 540\text{px}$.
- Added `box-sizing: border-box;`, `min-width: 0;`, and `overflow: hidden;` across `.tools-master-card` and `.tool-item-card`.
- Completely prevents tool cards from overflowing or cutting through the right border of the glassmorphic card container.

---

## 15. Industry-Standard Web Retrieval: Dual Tool Separation (`web_search` vs `fetch_web_page`)

### 15.1 The Anti-Pattern of Parameter Overloading ("Guess Game")
Attempting to overload a single `web_search` tool with optional `url` parameters and internal regex sniffing produces failure modes across LLMs:
- LLMs possess strong pre-trained priors that any tool named `web_search` expects a search query, leading them to generate descriptive keyword queries (e.g., `"hermesworkspace.com site overview and purpose"`).
- Search engines index third-party blog posts and forum discussions that match the keywords, returning unrelated articles instead of the actual destination domain.

### 15.2 The Unified Industry Architecture (Claude, OpenAI, Antigravity, Tavily)
All production coding agents and foundation models separate search from URL extraction into **two distinct first-class tools**:

| Tool | Antigravity / Gemini | Anthropic Claude | OpenAI | Akari Implementation | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Search Engine** | `search_web` | `web_search` | `web_search` | `web_search(query)` | Queries live web for broad news, facts, and topics |
| **URL Extractor** | `read_url_content` | `web_fetch` | `fetch_web_page` | `fetch_web_page(url)` | Directly fetches & parses content of a specific URL/site |

### 15.3 Execution Mechanics & Guarantees
1. **Deterministic Selection**:
   - When {{user}} provides a link (`https://hermesworkspace.com/`) or says *"check this site"*, the LLM unambiguously selects `fetch_web_page(url="https://hermesworkspace.com/")`.
2. **Defensive Safety Net**:
   - If an LLM calls `web_search` with a raw URL or domain, `web_search` automatically delegates execution to `fetch_web_page(url=...)`.
3. **Payload Condensation & Dual-Layer Brevity**:
   - `_clean_crawled_content` eliminates navigation links, images, and boilerplate menus, capping text at ~500 characters.
   - The tool payload includes an explicit instruction: `"instruction_for_akari": "State what this website is in 1 or 2 compact sentences. Do not mention unrelated blogs or unnecessary details, and do not write long paragraphs."`
   - `SYSTEM_PROMPT_AKARI_ASSISTANT` reinforces mandatory conciseness (1–2 sentences max).




