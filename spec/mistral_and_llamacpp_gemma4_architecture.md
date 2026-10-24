# Specification: Mistral AI & llama.cpp Gemma 4 Dual-Inference Pipeline
**Date**: October 24, 2026  
**Status**: Implemented & Verified  
**Related Code**: `./server/src/llm/mistral_model.py`, `./server/src/llm/llamacpp_model.py`, `./server/src/llm/provider.py`  
**Guidelines Reference**: `./GUIDLINES.md`

---

## 1. Overview & Architecture

Koko AI is designed with a focused, high-performance foundation model inference layer supporting two complementary AI gateways:
1. **Mistral AI**: Remote cloud API (`https://api.mistral.ai/v1`) powering `ministral-8b-latest` (fast 128k context conversation & function calling), `pixtral-12b-2409` (native multimodal vision), and `mistral-small-latest`.
2. **llama.cpp (Gemma 4)**: Local or self-hosted OpenAI-compatible HTTP server (`http://127.0.0.1:8080/v1`) running Google Gemma 4 models (`gemma-4-it`, `gemma-4-26b-a4b-it`) with native function calling.

Both providers share a unified streaming interface (`stream_chat`) in `./server/src/llm/provider.py` capable of 20-round multi-turn tool calling and cancellation handling.

---

## 2. Mistral AI Integration Details

### 2.1 Endpoint & Authentication
Mistral AI provides an OpenAI-compatible `/v1` endpoint. Authentication is established via HTTP Bearer token:
```python
client = OpenAI(
    base_url="https://api.mistral.ai/v1",
    api_key=os.getenv("MISTRAL_API_KEY"),
)
```

### 2.2 Tool Calling Schema
Mistral natively consumes standard OpenAI tool declarations:
```python
tools = [tool.to_openai_schema() for tool in tool_registry.get_all_tools()]
response = client.chat.completions.create(
    model="ministral-8b-latest",
    messages=messages,
    tools=tools,
    tool_choice="auto",
    stream=True,
)
```

---

## 3. llama.cpp Gemma 4 Integration Details

### 3.1 Local High-Performance Inference
llama.cpp serves Gemma 4 locally with zero API latency. The server URL defaults to `http://127.0.0.1:8080/v1` and can be adjusted at runtime from the client UI or `.env`.

### 3.2 Gemma 4 Native Function Calling
Gemma 4 natively understands tool schemas passed via `tools` and returns structured tool call deltas:
- `tool_calls[i].function.name`
- `tool_calls[i].function.arguments` (streamed JSON string fragments)

When tool calls are detected:
1. Tool arguments are accumulated and parsed into JSON dictionaries.
2. The server executes the function with timeout protection.
3. The tool result is injected with `role: "tool"` and `tool_call_id`.
4. The conversation resumes for up to 20 rounds until the model outputs conversational persona text.

---

## 4. Modal Boundary & Image Handling

To prevent HTTP 400 rejection errors on text-only models when users attach images in earlier turns:
- Current turn: passes native base64 Data URI inside `image_url` object.
- Historical turns: converts previous image attachments to plain text `[Image attached]` descriptors, preserving context without bloating payload sizes.
