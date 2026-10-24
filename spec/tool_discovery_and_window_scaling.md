# Tool Discovery, Pre-Decline Verification, and 20-Round Window Scaling

**Date:** 2026-10-08  
**Status:** Implemented & Verified  
**Related Files:**  
- `./server/src/prompts/system_prompt_akari.py`
- `./server/src/tools/builtins.py`
- `./server/src/tools/registry.py`
- `./server/src/config.py`
- `./server/src/bridge/websocket_server.py`
- `./server/src/llm/provider.py`
- `./server/src/llm/bedrock_model.py`
- `./client/src/networking/AvatarSocket.ts`
- `./client/src/components/screens/SettingsScreen.tsx`

---

## 1. Context & Motivation

As the Assistant's toolset grew to 12 distinct capabilities (including clock, time conversion, date calculations, system health, DuckDuckGo/Tavily web search, and webpage reading), two operational issues emerged during user testing:

1. **Failure to Inspect Available Tools**:
   When asked what tools she possessed or asked to perform an action she was unsure about, the LLM would occasionally decline or attempt to answer from internal weights without checking registered tools.
2. **5-Round Window Premature Termination**:
   A 5-round limit was too restrictive for complex agentic flows requiring tool discovery (`get_available_tools`), subsequent multi-step actions (web browsing or calculating), and iterative synthesis.
3. **Tool Name Asymmetry**:
   User requests mentioning "tool list" caused models to emit `get_tool_list`, whereas the backend tool was named `get_available_tools`.

---

## 2. Technical Architecture

### 2.1 Pre-Decline Tool Verification in System Prompt
In `server/src/prompts/system_prompt_akari.py`:
- Added a strict pre-decline rule:
  ```text
  - MANDATORY TOOL LIST CHECK BEFORE DECLINING ANY REQUEST OR TOOL CALL:
    - BEFORE declining any user request, saying you cannot do something, claiming you lack the capability or information, or declining a tool call:
      YOU MUST FIRST EXECUTE `get_available_tools` (or `get_tool_list`) to check your active registered tools catalog!
    - Never decline, say "I cannot check that", "I don't have tools for that", or "I don't know" without checking your tool list first. If an applicable tool is present in the list, you must execute that tool immediately to assist {{user}}!
  ```
- Added discovery tools directly to the `TOOL SELECTION GUIDE`:
  ```text
  - get_available_tools (alias: get_tool_list): MANDATORY check before declining any request or tool call. Also use whenever {{user}} asks what tools, features, commands, or capabilities you have, asks for a tool list, or asks "get tool list".
  ```

### 2.2 Dual Alias Registration & Flexible Registry Resolution
- Registered `get_tool_list` alongside `get_available_tools` in `BUILTIN_TOOLS` (`server/src/tools/builtins.py`).
- Added fuzzy alias resolution in `ToolRegistry.get_tool`:
  ```python
  if name in ("get_tool_list", "tool_list", "tools_list", "list_tools", "get_tools"):
      return self._tools.get("get_available_tools") or self._tools.get("get_tool_list")
  if name in ("get_available_tools", "available_tools"):
      return self._tools.get("get_tool_list") or self._tools.get("get_available_tools")
  ```
- Cleaned client Settings UI presentation so the redundant alias is omitted from user-facing toggle lists while remaining active for LLM execution.

### 2.3 Window Scaling to 20 Rounds
- Configured `MAX_TOOL_CALL_ROUNDS = int(os.getenv("MAX_TOOL_CALL_ROUNDS", "20"))` in `config.py`.
- Synchronized provider loops (`bedrock_model.py`, `openai_model.py`, `openrouter_model.py`, `mistral_model.py`, `freeai_model.py`, `chat/loop.py`).
- Raised clamping limit in `websocket_server.py`:
  ```python
  _max_tool_calls = max(1, min(20, int(data["max_calls"])))
  ```
- Configured frontend `AvatarSocket.ts` to transmit `maxCalls: 20`.

---

## 3. Results & Empirical Verification

Tests with `openai.gpt-oss-120b` on Bedrock Mantle confirmed:
1. `get_available_tools` is called automatically upon tool list queries.
2. Multi-turn execution successfully executes:
   - Round 1: `get_available_tools`
   - Round 2: `get_system_status`
   - Round 3: Natural conversational output in Tsundere gyaru persona.
