# AWS Bedrock Bearer Token & Mantle Integration

**Date:** 2026-10-02  
**Status:** Implemented & Verified  
**Related Files:**  
- `./server/.env`
- `./server/src/llm/bedrock_model.py`
- `./server/src/llm/provider.py`
- `./client/src/navigation/useNavigation.ts`
- `./client/src/components/screens/SettingsScreen.tsx`
- `./client/src/components/ChatInput.tsx`
- `./client/src/networking/AvatarSocket.ts`

---

## 1. Overview & Objective

AWS Bedrock API keys (`bedrock-api-key-...`) allow authenticating requests to Amazon Bedrock using an **HTTP Bearer token** (`Authorization: Bearer <key>`) instead of standard AWS IAM Signature Version 4 (SigV4) credentials.

This integration connects the assistant to **Amazon Bedrock Mantle**, an OpenAI-compatible distributed inference plane hosted on AWS infrastructure (`https://bedrock-mantle.{region}.api.aws/v1`), providing seamless chat completion, fast token streaming, and function calling (tool calling).

---

## 2. Authentication & Endpoint Architecture

### Bearer Token Format
The Bedrock API key is stored in the environment variable:
```env
AWS_BEARER_TOKEN_BEDROCK="bedrock-api-key-YmVkcm9jay..."
```
Inside the base64-encoded key is an action descriptor (`Action=CallWithBearerToken`) and the AWS region (e.g. `ap-south-1`).

### Endpoint Routing
- **Base URL:** `https://bedrock-mantle.{region}.api.aws/v1`
- **Region Detection:** Inferred automatically from `AWS_REGION`, `BEDROCK_REGION`, or decoded directly from the bearer token credential (defaulting to `ap-south-1`).
- **Client:** Configured using the standard `openai.OpenAI` Python SDK with `base_url` pointing to the Mantle endpoint and `api_key` set to the bearer token.

---

## 3. Supported Bedrock Models

The following high-performance foundation models are available and verified on Bedrock Mantle:

| Model ID | Display Name | Tool Calling | Vision Native | Context Window |
|---|---|---|---|---|
| `mistral.ministral-3-8b-instruct` | **Ministral 3 8B (Default)** | Supported | **Native Vision** | 128k |
| `mistral.ministral-3-14b-instruct` | **Ministral 3 14B** | Supported | **Native Vision** | 128k |
| `mistral.mistral-large-3-675b-instruct`| **Mistral Large 3 675B** | Supported | **Native Vision** | 128k |
| `qwen.qwen3-vl-235b-a22b-instruct` | **Qwen 3 VL 235B (Vision Flagship)** | Supported | **Native Vision** | 128k |
| `qwen.qwen3-32b` | **Qwen 3 32B (High Reasoning)** | Supported | Bedrock-assisted | 32k |
| `openai.gpt-oss-120b` | **OpenAI GPT-OSS 120B (Reasoning Flagship)** | Supported | Bedrock-assisted | 128k |
| `openai.gpt-oss-20b` | **OpenAI GPT-OSS 20B (Fast Reasoning)** | Supported | Bedrock-assisted | 128k |
| `google.gemma-3-4b-it` | **Google Gemma 3 4B (Fast)** | Disabled (Bypass) | Bedrock-assisted | 32k |
| `google.gemma-3-12b-it` | **Google Gemma 3 12B** | Disabled (Bypass) | Bedrock-assisted | 32k |
| `google.gemma-3-27b-it` | **Google Gemma 3 27B** | Disabled (Bypass) | Bedrock-assisted | 32k |
| `deepseek.v3.1` | **DeepSeek V3.1** | Supported | Bedrock-assisted | 64k |
| `deepseek.v3.2` | **DeepSeek V3.2** | Supported | Bedrock-assisted | 64k |
| `zai.glm-5` | **Zhipu GLM 5 (Frontier)** | Supported | Bedrock-assisted | 128k |
| `moonshotai.kimi-k2.5` | **Moonshot Kimi K2.5** | Supported | Bedrock-assisted | 128k |

*Note: For vision inputs, when `vision_supported` is True (e.g. Ministral 3, Qwen VL), images are passed directly to the Bedrock model as native multimodal image_url messages. When False (text-only models), visual features are extracted automatically using AWS Bedrock Ministral 3 and prepended to the prompt context.*

---

## 4. Key Learnings & Nuances

1. **`bedrock-runtime` vs. `bedrock-mantle`:**
   - Calling the traditional `bedrock-runtime` Converse API directly with a bearer token can throw `ValidationException: Operation not allowed` on accounts lacking standard IAM marketplace agreements.
   - Calling `bedrock-mantle.{region}.api.aws/v1` via OpenAI-compatible REST endpoints executes cleanly with full tool calling, streaming, and high throughput.
2. **Tool Calling Compatibility:**
   - Bedrock Mantle natively understands OpenAI's `tools` and `tool_choice` format, returning structured function call deltas (`delta.tool_calls`) that parse with existing tool execution loops for Mistral, Qwen, and OpenAI GPT-OSS.
3. **Google Gemma on Bedrock vs. OpenRouter (Gemma 3 vs. Gemma 4):**
   - **Bedrock Mantle:** Hosts strictly Google Gemma 3 (`google.gemma-3-4b-it`, `google.gemma-3-12b-it`, `google.gemma-3-27b-it`). Gemma 4 does not exist on Bedrock Mantle (returns 404). On Gemma 3, passing the `tools` parameter alongside system prompts causes Mantle's proxy to drop tokens; `bedrock_model.py` automatically routes Gemma 3 via fast conversational streaming bypass.
   - **OpenRouter:** Natively hosts Google Gemma 4 (`google/gemma-4-31b-it:free` and `google/gemma-4-26b-a4b-it:free`) with full Google function calling specification support (`<|tool_call|>call:name{args}<tool_call|>`, `tool_responses`, and type casting).
4. **Windows Console Charset (CP1252 vs. UTF-8):**
   - Gemma and GPT-OSS models frequently output emoji characters (e.g. 😊, 👋). In default Python on Windows, writing these to `sys.stdout` caused `UnicodeEncodeError: 'charmap' codec can't encode character`.
   - Fixed by calling `sys.stdout.reconfigure(encoding='utf-8', errors='replace')` in `main.py` and wrapping token terminal printing in safe exception handling.
5. **Bedrock Model Activation Audit:**
   - A live test of all 41 foundation models in `client.models.list()` was performed.
   - Models returning HTTP 404 or activation errors (`anthropic.claude-opus-5`, `anthropic.claude-sonnet-5`, `google.gemma-4-*`, `openai.gpt-6-*`, `openai.gpt-5.5`) have been filtered out and removed from the active Bedrock model selection. Only models that pass live chat completions with HTTP 200 are exposed to the user.
6. **Token Detection & UI Status:**
   - The UI Settings screen connects to the backend WebSocket and requests config via `get_config`.
   - When `AWS_BEARER_TOKEN_BEDROCK` is detected in `./server/.env`, the backend reports `"bedrock": true` in `api_keys_configured`.
   - The Settings screen displays `Token Active` with a green indicator, pre-populates the input placeholder with `Configured in server .env (AWS_BEARER_TOKEN_BEDROCK)`, and provides visual confirmation that inference is ready.
   - If the user saves a token locally in the browser, `AvatarSocket` synchronizes `akari_bedrock_bearer_token` automatically upon connection.
7. **History Image Sanitization & Modality Boundary:**
   - Previously, turns with images stored the complete base64 `image_url` data URI in `_history`.
   - When users switched to text-only models (e.g. `openai.gpt-oss-120b`, `google.gemma-3-4b-it`) or continued the conversation, Bedrock Mantle inspected past message turns in `history`, found the `image_url`, and rejected the request with `Error code: 400 - Model does not support image modality`.
   - Fixed by storing clean text descriptors in `_history` (`[Image attached] {user_text}`) and sanitizing any historical list content to plain text before sending to LLM APIs. Only the CURRENT turn's image is passed as a multimodal payload when supported.
