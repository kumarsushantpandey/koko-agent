# Phase 05: Agentic Tool Calling & Real-Time Search
**Task**: Build the 12-tool agentic execution subsystem with 20-round multi-turn scaling, dynamic tool discovery, anti-stalling recovery, and live web search/reader.  
**Related Phase**: `./docs/implementation/04_llm_inference_and_bedrock_mantle.md`  
**Referenced Skill**: `./.agents/skills/llm-agentic-tool-pipeline/SKILL.md`

---

## 1. Architectural Goal

Provide a robust tool-calling architecture enabling Akari to gather live, real-world data:
1. **Dynamic Tool Discovery**: `get_available_tools` / `get_tool_list` allowing the model to inspect its registered capabilities.
2. **Mandatory Pre-Decline Rule**: Strict prompt instruction prohibiting Akari from saying she cannot do something without querying her tool catalog first.
3. **20-Round Multi-Turn Execution**: Chaining multi-step workflows (e.g. Discovery $\to$ Web Search $\to$ Page Read $\to$ Math $\to$ Response).
4. **Anti-Stalling Recovery**: Detecting conversational excuses (*"Wait, I'll check!"*) and compelling tool execution with `tool_choice="any"`.
5. **Live Web Search & Extraction**: Tavily AI + DuckDuckGo fallback, and direct web page inspection with 1–2 sentence conciseness enforcement.

---

## 2. Agent Skill & Implementation Prompt

When delegating this phase to an AI agent, use the following prompt:

```markdown
Build the 12-tool agentic function calling subsystem in `./server/src/tools/`:
1. In `base.py`, define the `Tool` dataclass with `to_openai_schema()` and `to_summary_dict()`.
2. In `registry.py`, build `ToolRegistry` with timeout protection and resilient alias resolution (`get_tool_list` -> `get_available_tools`).
3. In `builtins.py`, implement 12 tools:
   - Dynamic discovery: `get_available_tools`, `get_tool_list`.
   - Time & Clock: `get_current_time`, `get_timezone_info`, `convert_time`, `time_difference`.
   - Calendar: `get_current_date`, `get_day_of_week`.
   - Math: `calculate` (AST-safe precision expression evaluation).
   - System: `get_system_status` (OS, Python runtime, model).
   - Web Search: `web_search` (Tavily AI with DuckDuckGo fallback).
   - Web Reader: `fetch_web_page` (Tavily Extract with HTTP GET fallback).
4. Scale `MAX_TOOL_CALL_ROUNDS` to 20 across server config, streaming loops, and WebSocket bridge.
5. In `./server/src/prompts/system_prompt_akari.py`, enforce the Mandatory Pre-Decline Rule and 1-2 sentence response brevity.
```

---

## 3. Core Implementation

### 3.1 Resilient Registry Lookup (`./server/src/tools/registry.py`)

```python
class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, Tool] = {}
        for tool in BUILTIN_TOOLS:
            self.register(tool)

    def register(self, tool: Tool):
        self._tools[tool.name] = tool

    def get_tool(self, name: str) -> Tool | None:
        tool = self._tools.get(name)
        if tool is not None:
            return tool
        # Resilient alias mapping for tool discovery
        if name in ("get_tool_list", "tool_list", "tools_list", "list_tools", "get_tools"):
            return self._tools.get("get_available_tools") or self._tools.get("get_tool_list")
        if name in ("get_available_tools", "available_tools"):
            return self._tools.get("get_tool_list") or self._tools.get("get_available_tools")
        return None
```

### 3.2 AST-Safe Precision Calculator (`./server/src/tools/builtins.py`)

```python
import ast
import operator
import math

_SAFE_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.Mod: operator.mod,
}

def calculate(expression: str) -> dict:
    """Safely evaluates arithmetic expressions without eval()."""
    try:
        # Preprocess percentages: '15% of 85' -> '(15 / 100) * 85'
        expr = re.sub(r"(\d+(?:\.\d+)?)\s*%\s*(?:of)?\s*(\d+(?:\.\d+)?)", r"(\1 / 100) * \2", expression)
        node = ast.parse(expr, mode="eval").body

        def _eval(n):
            if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
                return n.value
            if isinstance(n, ast.BinOp) and type(n.op) in _SAFE_OPERATORS:
                return _SAFE_OPERATORS[type(n.op)](_eval(n.left), _eval(n.right))
            raise ValueError("Unsupported operation")

        result = _eval(node)
        return {"status": "success", "expression": expression, "result": result}
    except Exception as e:
        return {"status": "error", "error": f"Invalid expression: {e}"}
```

### 3.3 Mandatory Pre-Decline Rule (`./server/src/prompts/system_prompt_akari.py`)

```python
REAL-TIME TOOLS & FUNCTION CALLING RULES:
- MANDATORY TOOL LIST CHECK BEFORE DECLINING ANY REQUEST:
  - BEFORE declining any user request, saying you cannot do something, claiming you lack capability, or declining a tool call:
    YOU MUST FIRST EXECUTE `get_available_tools` (or `get_tool_list`) to check your active registered tools catalog!
  - Never decline or say "I cannot check that" without checking your tool list first. If an applicable tool is present, execute it immediately!
- ABSOLUTE PROHIBITION ON CONVERSATIONAL EXCUSES:
  - NEVER say "[angry] I'll check!", "Wait let me check", or "Let me look at that" without executing the tool in the same turn.
```

---

## 4. Verification & Testing Instructions

### 4.1 Automated Tool Registry Test
Create `./server/scratch_test_tools.py`:
```python
import asyncio
from src.tools import tool_registry

async def test_tools():
    # Test 1: Math calculation
    calc = await tool_registry.execute_tool("calculate", {"expression": "458 * 32"})
    assert calc["result"] == 14656
    print("✓ Calculate tool OK (458 * 32 =", calc["result"], ")")

    # Test 2: Tool discovery alias resolution
    discovery = await tool_registry.execute_tool("get_tool_list", {})
    assert discovery["total_tools"] >= 10
    print("✓ Tool discovery alias OK (total tools:", discovery["total_tools"], ")")

    # Test 3: System status
    sys_status = await tool_registry.execute_tool("get_system_status", {})
    assert sys_status["status"] == "success"
    print("✓ System status OK (OS:", sys_status["os"], ")")

asyncio.run(test_tools())
```

Run test:
```bash
cd server
uv run python scratch_test_tools.py
```
**Expected Output**:
```
✓ Calculate tool OK (458 * 32 = 14656 )
✓ Tool discovery alias OK (total tools: 12 )
✓ System status OK (OS: Windows 11 ... )
```

### 4.2 Conversational Chaining Test
In the browser chat input bar:
1. Ask: *"What tools do you have? Check your capabilities."*
   - Verify terminal trace: Round 1 executes `get_available_tools`. Akari responds describing her tools in Tsundere persona.
2. Ask: *"Can you check the current time in Tokyo?"*
   - Verify terminal trace: Model calls `get_current_time` with `location: "Tokyo"`, receives the time, and speaks the answer in character.
