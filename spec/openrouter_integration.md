# OpenRouter LLM Provider Integration Specification

**Status**: Active  
**Date**: 2026-09-27  
**Provider**: OpenRouter (Unified AI Gateway)  
**Website**: `https://openrouter.ai/`  
**API Endpoint**: `https://openrouter.ai/api/v1`  

---

## 1. Executive Summary

Integration of OpenRouter as an inference provider for the Akari Watanabe AI assistant. OpenRouter provides access to a large ecosystem of models through an OpenAI-compatible API. This integration specifically targets **100% free models** (`:free` suffix and zero-cost pricing) that natively support tool calling (function calling), streaming completions, and emotion classification.

---

## 2. API & Authentication

- **API Base URL**: `https://openrouter.ai/api/v1`
- **Environment Variable**: `OPENROUTER_APIKEY` (or `OPENROUTER_API_KEY`)
- **Key Source**: OpenRouter Settings → Keys (`https://openrouter.ai/keys`)
- **OpenAI Compatibility**: Built using the existing `openai` Python package (`openai>=3.19.2`). No additional dependencies required.
- **Client Configuration**:
  ```python
  client = OpenAI(
      base_url="https://openrouter.ai/api/v1",
      api_key=os.getenv("OPENROUTER_APIKEY"),
      timeout=45.0,
      default_headers={
          "HTTP-Referer": "https://github.com/Lakshyakumar266/",
          "X-Title": "Akari Watanabe",
      },
  )
  ```

---

## 3. Verified Free Models Catalog

All integrated models were dynamically verified against `https://openrouter.ai/api/v1/models` for zero prompt/completion pricing and `'tools'` in `supported_parameters`, and tested live with function calling:

| Model ID | Display Name | Context Window | Tool Calling | Special Notes |
|---|---|---|---|---|
| `openrouter/free` | Free Models Router (Recommended) | 200k tokens | ✅ Verified | Automatically routes to the highest-availability working free model. Fails over if an individual provider has high load. |
| `inclusionai/ling-3.0-flash-sante:free` | Ling 3.0 Flash Sante | 262k tokens | ✅ Verified | Extremely fast, reliable tool calling with strong dialogue coherence. |
| `liquid/lfm-2.5-2.6b:free` | Liquid LFM 2.5 2.6B | 65k tokens | ✅ Verified | Ultra-fast lightweight model for low latency. |
| `stealth/space-bunny-alpha` | Space Bunny Alpha | 1M tokens | ✅ Verified | Massive 1M context window on a free model. |
| `poolside/laguna-s-2.1:free` | Laguna S 2.1 | 262k tokens | ✅ Verified | Good reasoning and function call trigger accuracy. |
| `qwen/qwen3.8-27b:free` | Qwen 3.8 27B | 262k tokens | ✅ Verified | High capability, though subject to shared upstream provider capacity during peak hours. |

---

## 4. Rate Limits & Quotas

- **Platform Free Tier**:
  - Accounts with under $10 lifetime credits: **20 requests per minute (RPM)** and **50 requests per day**.
  - Accounts with $10+ lifetime credits (one-time): **20 RPM** and **1,000 requests per day** for free models.
- **Upstream Pool Saturation**: Free models share capacity pools across all OpenRouter users. If a single upstream model is overloaded, it returns `429`. Using `openrouter/free` as the default mitigates this by automatically choosing available providers.

---

## 5. Technical Implementation

### 5.1 Streaming & Multi-Round Tool Calling

Follows the assistant's standard multi-round tool loop:
1. Converts conversation history to OpenAI standard format (`role="system"`, `"user"`, `"assistant"`).
2. Sends tool definitions (`tool_registry.get_tool_definitions(only_enabled=True)`).
3. In streaming mode, chunks accumulate `delta.tool_calls` by index (`id`, `name`, `arguments`).
4. If tool calls are requested:
   - Isolates intermediate speech so filler text like "let me check" is not sent to TTS.
   - Appends assistant message with `tool_calls`.
   - Executes each tool concurrently/asynchronously via `tool_registry.execute_tool`.
   - Appends tool result message with `role="tool"`, `tool_call_id`, and JSON output.
   - Loops to round 2 to stream the final conversational response with emotion tags.
5. If no tool calls are requested, tokens stream directly to the TTS / audio player pipeline.

### 5.2 Emotion Classification

Uses `classify_emotion()` with `temperature=0.1` and `max_tokens=10` to categorize response text into the 6 VRM emotion presets (`Happy`, `Sad`, `Angry`, `Surprised`, `Relaxed`, `Neutral`).

---

## 6. Files Created / Modified

| File | Action | Description |
|---|---|---|
| `./server/src/llm/openrouter_model.py` | **Created** | OpenRouter provider implementation: streaming, tool calling, and emotion classification |
| `./server/src/llm/provider.py` | **Modified** | Registered `openrouter` in `AVAILABLE_PROVIDERS`, auto-detection from `OPENROUTER_APIKEY`, and routing in `stream_chat`/`classify_emotion` |
| `./server/.env.example` | **Modified** | Added `OPENROUTER_APIKEY` documentation |
| `./client/src/navigation/useNavigation.ts` | **Modified** | Added `openrouter` to URL validation and `openrouter/free` default model mapping |
| `./client/src/components/screens/SettingsScreen.tsx` | **Modified** | Added OpenRouter provider card with all 6 verified free models in the Settings UI |
| `./spec/openrouter_integration.md` | **Created** | Comprehensive integration documentation |

---

## 7. Verification Results

- **Tool Execution Test**:
  - `openrouter/free`: Successfully executed `get_current_time`, returned `12:36 AM`, and generated Akari tsundere response with emotion tags `[happy]... [surprised]... [relaxed]...`.
  - `inclusionai/ling-3.0-flash-sante:free`: Successfully executed `get_current_time` and responded with `[happy]... [neutral]...`.
- **Emotion Classifier Test**:
  - Input: *"What are you doing here?! It's not like I wanted you to come or anything, baka!"* → Output: `Angry`.
- **Client Build**:
  - `bun run build` passed with zero errors (`tsc -b && vite build` in 3.54s).
