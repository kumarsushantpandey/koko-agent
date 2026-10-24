---
name: llm-agentic-tool-pipeline
description: Engineering blueprints for multimodal LLM inference, 20-round agentic function calling, dynamic tool discovery, anti-stalling enforcement, and multi-tier live web search/crawling.
---

# LLM Agentic Tool Pipeline Skill

Use this skill when implementing multi-provider LLM inference, function calling, tool discovery, and anti-stalling loops for conversational AI companions and agents.

---

## 1. Multi-Provider Abstraction Architecture

Standardize provider interfaces across OpenAI, AWS Bedrock Mantle, Mistral AI, OpenRouter, and local/free gateways:

```python
class LLMProvider:
    def stream_chat(
        self,
        prompt: str,
        history: list,
        image: str | None = None,
        tools_enabled: bool = False,
        max_tool_rounds: int = 20,
        on_tool_activity: Callable[[str, str], None] | None = None,
        cancel_event: threading.Event | None = None,
    ) -> Generator[str, None, None]:
        ...
```

---

## 2. Amazon Bedrock Mantle Integration (Bearer Token)

Amazon Bedrock Mantle provides OpenAI-compatible distributed inference endpoints (`https://bedrock-mantle.{region}.api.aws/v1`):

```python
from openai import OpenAI

def get_bedrock_client(bearer_token: str, region: str = "ap-south-1") -> OpenAI:
    return OpenAI(
        base_url=f"https://bedrock-mantle.{region}.api.aws/v1",
        api_key=bearer_token,
    )
```

### Critical Rules:
1. **Modal Boundary Sanitization**: Past turns with images must be stored as plain text `[Image attached] {user_text}` in history. Passing historical base64 image objects to text-only models (e.g. `gpt-oss-120b`) causes HTTP 400 errors.
2. **Gemma 3 vs Gemma 4**: Gemma 3 on Bedrock Mantle drops tokens when function tool schemas are passed alongside system prompts. Route Gemma 3 through conversational streaming bypass; use OpenRouter for native Gemma 4 tool calling.

---

## 3. Dynamic Tool Discovery & The Mandatory Pre-Decline Rule

### The Problem:
Models frequently hallucinate that they cannot answer or lack capabilities instead of checking their available tools.

### The Solution:
1. Register `get_available_tools` with aliases (`get_tool_list`, `tool_list`, `list_tools`).
2. Enforce the **Mandatory Pre-Decline Rule** in the system prompt:
   ```
   BEFORE declining any user request, saying you cannot do something, or claiming you lack capability:
   YOU MUST FIRST EXECUTE get_available_tools to check your active registered tools catalog!
   ```
3. Implement resilient lookup in `ToolRegistry`:
   ```python
   def get_tool(self, name: str) -> Tool | None:
       tool = self._tools.get(name)
       if tool: return tool
       if name in ("get_tool_list", "tool_list", "tools_list", "list_tools"):
           return self._tools.get("get_available_tools")
       return None
   ```

---

## 4. Anti-Stalling Intent Detection & Recovery

Smaller models (8B parameters) often generate conversational excuses (*"Wait a second, let me check that!"*) instead of invoking a tool.

### Recovery Algorithm:
1. Detect explicit tool intent: URLs, calculation expressions (`15 * 85`), or clock queries.
2. If tool intent is present, pass `tool_choice="any"` on Round 1.
3. If the model outputs a conversational stalling phrase without emitting a tool call:
   - Withhold the excuse from the user.
   - Immediately re-issue the request with forced `tool_choice="any"`.
   - Execute the tool and stream the final persona response grounded on actual data.

---

## 5. Multi-Tier Web Search & Reader

Separate open-ended web search from specific URL page inspection:

1. **`fetch_web_page(url: str)`**:
   - Primary: Tavily Extract API (`POST https://api.tavily.com/extract`).
   - Fallback: Direct HTTP GET stripping HTML boilerplate.
   - Enforce 1–2 sentence conciseness directive to prevent rambling.
2. **`web_search(query: str, max_results: int = 3)`**:
   - Primary: Authenticated Tavily AI search.
   - Fallback: DuckDuckGo search.
   - Defensive delegation: If a user sends a pure URL to `web_search`, automatically route to `fetch_web_page`.
