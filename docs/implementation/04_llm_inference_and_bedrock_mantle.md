# Phase 04: Multi-Provider LLM & Bedrock Mantle Integration
**Task**: Build the unified LLM inference layer supporting AWS Bedrock Mantle (Bearer Token auth), OpenAI, Mistral AI, OpenRouter (Gemma 4 native function calling), and Free.ai.  
**Related Phase**: `./docs/implementation/03_full_duplex_websocket_bridge_and_asr.md`  
**Referenced Skill**: `./.agents/skills/llm-agentic-tool-pipeline/SKILL.md`

---

## 1. Architectural Goal

Provide a pluggable foundation model routing layer (`./server/src/llm/provider.py`) enabling instant runtime switching across 5 AI gateways with uniform token streaming:
1. **AWS Bedrock Mantle**: Distributed high-throughput OpenAI-compatible inference (`https://bedrock-mantle.{region}.api.aws/v1`) authenticated via `AWS_BEARER_TOKEN_BEDROCK`.
2. **OpenAI**: Native GPT-4o, GPT-4o Mini, GPT-4 Turbo.
3. **Mistral AI**: Ministral 8B, Pixtral 12B (native vision), Mistral Small.
4. **OpenRouter Free Tier**: Auto-router, Google Gemma 4 (31B/26B native function calling), Ling 3.0 Flash.
5. **Free.ai**: Keyless gateway for Qwen 2.5 7B and Qwen 3 8B.

---

## 2. Agent Skill & Implementation Prompt

When delegating this phase to an AI agent, use the following prompt:

```markdown
Build the multi-provider LLM inference engine in `./server/src/llm/`:
1. Implement `bedrock_model.py` using `openai.OpenAI` pointed to `https://bedrock-mantle.{region}.api.aws/v1` with bearer token auth (`AWS_BEARER_TOKEN_BEDROCK`).
   - Decode AWS region automatically from bearer token credential string (default: `ap-south-1`).
   - Sanitize history: strip past multimodal image payloads to prevent Bedrock HTTP 400 modal boundary errors on text-only models.
   - For Google Gemma 3, bypass Mantle function schema dropping by streaming directly.
2. Implement `openai_model.py`, `mistral_model.py`, `openrouter_model.py`, and `freeai_model.py`.
3. Unify providers in `provider.py` exposing `stream_chat_multi_round(...)`.
4. Fix Windows console UTF-8 character encoding in `main.py` (`sys.stdout.reconfigure(encoding='utf-8')`).
```

---

## 3. Core Implementation

### 3.1 AWS Bedrock Mantle Client (`./server/src/llm/bedrock_model.py`)

```python
import os
import base64
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

DEFAULT_REGION = "ap-south-1"

def get_region() -> str:
    env_region = os.getenv("BEDROCK_REGION") or os.getenv("AWS_REGION")
    if env_region:
        return env_region.strip()

    # Automatically extract region from bearer token if present
    token = os.getenv("AWS_BEARER_TOKEN_BEDROCK", "")
    if "bedrock-api-key-" in token:
        try:
            b64_part = token.split("bedrock-api-key-", 1)[1]
            b64_part += "=" * (-len(b64_part) % 4)
            decoded = base64.b64decode(b64_part).decode("utf-8", errors="ignore")
            for part in decoded.split("&"):
                if "Credential=" in part:
                    pieces = part.split("Credential=", 1)[1].replace("%2F", "/").split("/")
                    if len(pieces) >= 3:
                        return pieces[2]
        except Exception:
            pass
    return DEFAULT_REGION

def get_client() -> OpenAI:
    region = get_region()
    token = os.getenv("AWS_BEARER_TOKEN_BEDROCK", "")
    return OpenAI(
        base_url=f"https://bedrock-mantle.{region}.api.aws/v1",
        api_key=token,
    )
```

### 3.2 Modal Boundary History Sanitization (`./server/src/llm/bedrock_model.py`)

```python
def _format_messages(prompt: str, history: list, image: str | None = None, tools_enabled: bool = False):
    messages = [{"role": "system", "content": get_system_prompt(tools_enabled=tools_enabled)}]

    for item in history:
        role = getattr(item, "role", "user")
        content = getattr(item, "content", "")

        # Strip past base64 image payloads so text models do not reject request
        if isinstance(content, list):
            text_parts = [p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text"]
            content = " ".join(filter(None, text_parts)).strip() or "[Attached Image]"
        elif not isinstance(content, str):
            content = str(content)

        messages.append({"role": role, "content": content})

    # Pass native image only for CURRENT turn
    if image:
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": prompt or "Look at this image."},
                {"type": "image_url", "image_url": {"url": image}},
            ],
        })
    else:
        messages.append({"role": "user", "content": prompt})

    return messages
```

### 3.3 Windows Console UTF-8 Fix (`./server/src/main.py`)

Gemma 3, GPT-OSS, and Qwen frequently output emojis (😊, 👋, ✨). Prevent Windows `charmap` crashes:
```python
import sys

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
```

---

## 4. Verification & Testing Instructions

### 4.1 Bedrock Mantle Inference Smoke Test
Create `./server/scratch_test_bedrock.py`:
```python
from src.llm.bedrock_model import stream_chat

print("Testing Bedrock Mantle with Ministral 3 8B...")
for token in stream_chat("Hello Akari! Introduce yourself in 1 sentence.", history=[]):
    print(token, end="", flush=True)
print("\n✓ Bedrock streaming completed cleanly.")
```

Run test:
```bash
cd server
uv run python scratch_test_bedrock.py
```
**Expected Output**:
```
Testing Bedrock Mantle with Ministral 3 8B...
[happy] Hey there! I'm Akari Watanabe—don't you forget it!
✓ Bedrock streaming completed cleanly.
```

### 4.2 Multi-Provider Switching Test
1. In the browser UI (`http://localhost:5173/?screen=settings`), switch provider from **AWS Bedrock** to **Mistral AI** or **OpenRouter**.
2. Return to the Chat screen and send a message.
3. Verify that the terminal logs confirm the active provider switched dynamically without restarting the server.
