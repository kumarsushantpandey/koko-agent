# Tool Calling Enforcement & Conversational Stalling Prevention

**Date:** 2026-10-02  
**Status:** Implemented & Verified  
**Related Files:**  
- `./server/src/llm/mistral_model.py`
- `./server/src/llm/openai_model.py`
- `./server/src/prompts/system_prompt_akari.py`
- `./server/src/tools/builtins.py`
- `./server/src/tools/registry.py`
- `./server/src/chat/loop.py`

---

## 1. Problem Statement & Root Cause Analysis

### 1.1 The Symptom
When asking Akari questions requiring real-time external tools (e.g. *"whats time rightnow??"* or *"do the toolcall brah, search for that https://example.com/search/18"*), the LLM responded with conversational roleplay instead of executing the tool:

```
[Chat] Akari: [angry] Ugh, seriously?! Can’t you see I’m busy with this weird search?! But fine, I’ll check the time for you! [neutral] Wait, let me just do it quick.
```

The model outputted text promising it would check, but no actual tool call was emitted. The client received spoken audio saying *"Wait, let me just do it quick"*, and the conversation halted with zero factual data.

### 1.2 Root Cause Analysis

Three distinct factors contributed to this failure mode:

1. **Format Constraint Conflict in 8B-Class Models:**  
   The system prompt mandated:
   > *"Reply as spoken dialogue only after emotion tags."*  
   > *"- DEFAULT TO CONVERSATIONAL DIALOGUE: You are an anime Assistant, not an automated search engine."*  
   
   Smaller models (e.g. `ministral-8b-latest`, 8B parameters) prioritize these high-weight system prompt directives and conclude that *every output must be a spoken line beginning with an emotion tag (`[angry] ...`)*. The model outputted tsundere banter promising to check rather than emitting an empty content message with structured `tool_calls`.

2. **History Contamination:**  
   Once the assistant outputted a conversational excuse in turn $N$ (*"Fine, I'll look at the titles! Now shut up and let me do this!"*), that turn was appended to `_history`. In turn $N+1$, the model perceived a pattern where the assistant roleplays about checking rather than calling the API.

3. **Missing `tool_choice` Parameter in API Call:**  
   In `./server/src/llm/mistral_model.py`, `client.chat.stream()` did not specify `tool_choice="auto"`. Without an explicit choice parameter, Mistral defaulted to text generation whenever dialogue context was strong.

4. **Flawed Stream Finish Reason Condition:**  
   In `mistral_model.py`, the condition:
   ```python
   if not tool_calls_dict or finish_reason != "tool_calls":
       for c in round_content_chunks:
           yield c
       break
   ```
   Checking `finish_reason != "tool_calls"` caused valid tool calls to be discarded if an intermediate or trailing stream chunk reported `finish_reason=None` or `finish_reason="stop"`.

---

## 2. Architecture & Solution

### 2.1 System Prompt Refactoring
In `./server/src/prompts/system_prompt_akari.py`, the tool rules were upgraded to separate tool execution from dialogue delivery:

```python
REAL-TIME TOOLS & FUNCTION CALLING RULES (STRICT):
- MANDATORY TOOL INVOCATION: When the user asks for real-time external information (current time, timezone, clock, date, day of the week), provides a website URL or link (http:// or https://), asks to search the web, asks for a math calculation, or asks you to do a toolcall:
  YOU MUST EXECUTE THE CORRESPONDING FUNCTION CALL DIRECTLY.
- ABSOLUTE PROHIBITION ON CONVERSATIONAL EXCUSES:
  - NEVER say "[angry] I'll check!", "[neutral] Wait let me check", "Fine, I'll search it", or "Let me look at the titles" in conversational text WITHOUT executing the function.
  - A text promise is NOT a function call. If you are about to check something, YOU MUST INVOKE THE FUNCTION IMMEDIATELY.
  - Do NOT output spoken dialogue or emotion tags when making a tool call. Emit the function call directly.
  - Spoken dialogue and emotion tags are ONLY for your final reply to {{user}} AFTER receiving the tool's result.
- TOOL SELECTION GUIDE:
  - get_current_time: Whenever {{user}} asks for current time, timezone, or clock.
  - get_current_date: Whenever {{user}} asks for today's date or day of the week.
  - fetch_web_page: Whenever {{user}} provides a website link/URL, or asks to read, inspect, or summarize a specific website.
  - web_search: Whenever {{user}} asks to search for something online or look up recent news.
  - calculate: Whenever {{user}} asks for arithmetic or mathematical computations.
```

### 2.2 Intent Detection & Conversational Stalling Recovery
In `./server/src/llm/mistral_model.py`, two heuristics detect when a model is failing to invoke a tool:

```python
def _has_explicit_tool_intent(text: str) -> bool:
    """Detects whether user prompt unambiguously asks for an action that requires tools."""
    lowered = text.lower()
    if (
        "http://" in lowered
        or "https://" in lowered
        or "www." in lowered
        or re.search(r"\b[a-zA-Z0-9-]+\.(?:com|org|net|io|co|app|ai|me)\b", lowered)
    ):
        return True
    tool_keywords = [
        "toolcall", "tool call", "use tool", "call tool", "call the tool",
        "what time", "current time", "time now", "whats time", "what's time", "timezone",
        "what date", "today's date", "todays date", "day of the week", "what day",
        "calculate", "search for", "google", "look up", "browse", "website",
    ]
    if any(kw in lowered for kw in tool_keywords):
        return True
    if re.search(r"\b\d+\s*[\+\-\*\/\^]\s*\d+\b", lowered):
        return True
    return False

def _is_conversational_stalling(text: str) -> bool:
    """Detects if model generated a conversational stalling excuse instead of calling the tool."""
    lowered = text.lower()
    stalling_phrases = [
        "i'll check", "ill check", "i will check",
        "let me check", "let me look", "i'll look", "ill look", "i will look",
        "checking the", "wait, let me", "hold on, let me",
        "i'm gonna look", "im gonna look", "just gonna look",
        "i'll check it out", "ill check it out",
    ]
    return any(p in lowered for p in stalling_phrases)
```

### 2.3 Two-Tier Execution Strategy

1. **Round 1 Choice Selection:**
   - If `_has_explicit_tool_intent(prompt)` is `True`, `tool_choice="any"` is passed to Mistral, compelling the model to select a valid tool from the schema.
   - Otherwise, `tool_choice="auto"` is passed for normal conversation.

2. **Stalling Recovery Fallback:**
   - If `tool_calls_dict` remains empty after round 1, but the model outputted text matching `_is_conversational_stalling()` or the prompt contained explicit tool intent:
   - The conversational excuse is withheld from the user.
   - The engine automatically issues a retry request with `tool_choice="any"`.
   - The forced tool call executes, and the model then streams the final persona response grounded on actual data.

---

## 3. Verification & Benchmark Results

### Test Case 1: Real-Time Clock Query
**Input:** `whats time rightnow??`  
**Execution Trace:**
```
[Mistral] stream_chat starting with model: 'ministral-8b-latest' (tools_enabled=True, has_image=False)
[Mistral Tool] Executing 'get_current_time' (args: {})
[Mistral Tool] Executed 'get_current_time' -> {'status': 'success', 'location': "User's Local Time", 'is_user_local_time': True, 'time_12h': '2:24 AM', 'date': 'Friday, October 02, 2026', 'timezone_name': 'India Standard Time', 'utc_offset': 'UTC+05:30'}
Output: '[happy] Ohhh, it’s still nighttime? ... at least it’s Friday... [angry] Don’t even think about hitting snooze, you lazy thing!'
```
*Result:* Correct tool call executed on round 1 with zero hallucination.

### Test Case 2: URL Inspection Query
**Input:** `do the toolcall brah, search for that https://hermesworkspace.com/search/18`  
**Execution Trace:**
```
[Mistral] stream_chat starting with model: 'ministral-8b-latest' (tools_enabled=True, has_image=False)
[Mistral Tool] Executing 'fetch_web_page' (args: {"url": "https://hermesworkspace.com/search/18"})
[Mistral Tool] Executed 'fetch_web_page' -> {'status': 'error', 'error': "Failed to fetch content from URL 'https://hermesworkspace.com/search/18'..."}
Output: '[angry] Ugh, that website’s acting up again! What a waste of time...'
```
*Result:* Directly invoked `fetch_web_page` with exact URL argument, acknowledging network results in character.
