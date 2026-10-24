from __future__ import annotations
import logging
import threading
from typing import Any, Callable, Generator

from src import config
from src.llm.mistral_model import stream_chat_mistral
from src.llm.llamacpp_model import stream_chat_llamacpp

logger = logging.getLogger(__name__)

# Active runtime provider settings
_active_provider: str = config.DEFAULT_LLM_PROVIDER
_active_model: str = config.DEFAULT_MISTRAL_MODEL if _active_provider == "mistral" else config.LLAMACPP_MODEL
_runtime_api_keys: dict[str, str] = {}
_runtime_llamacpp_url: str = config.LLAMACPP_BASE_URL

def set_active_provider(provider: str, model: str | None = None):
    global _active_provider, _active_model
    p = provider.lower().strip()
    if p in ("mistral", "mistralai"):
        _active_provider = "mistral"
        _active_model = model or config.DEFAULT_MISTRAL_MODEL
    elif p in ("llama_cpp", "llamacpp", "gemma", "gemma4"):
        _active_provider = "llama_cpp"
        _active_model = model or config.LLAMACPP_MODEL
    else:
        logger.warning("Unrecognized provider '%s'. Defaulting to mistral.", provider)
        _active_provider = "mistral"
        _active_model = model or config.DEFAULT_MISTRAL_MODEL
    logger.info("Active LLM provider set to '%s' (model: '%s')", _active_provider, _active_model)

def set_runtime_api_key(provider: str, key: str):
    _runtime_api_keys[provider.lower().strip()] = key.strip()

def set_runtime_llamacpp_url(url: str):
    global _runtime_llamacpp_url
    _runtime_llamacpp_url = url.strip()

def get_active_provider_info() -> dict[str, Any]:
    return {
        "provider": _active_provider,
        "model": _active_model,
        "available_providers": [
            {
                "id": "mistral",
                "name": "Mistral AI",
                "models": [
                    {"id": "ministral-8b-latest", "name": "Ministral 8B Latest", "context": "128k", "tools": True},
                    {"id": "pixtral-12b-2409", "name": "Pixtral 12B (Vision)", "context": "128k", "vision": True},
                    {"id": "mistral-small-latest", "name": "Mistral Small Latest", "context": "32k", "tools": True},
                ],
            },
            {
                "id": "llama_cpp",
                "name": "llama.cpp (Gemma 4)",
                "base_url": _runtime_llamacpp_url,
                "models": [
                    {
                        "id": "ggml-org/gemma-4-E2B-it-GGUF:Q4_0",
                        "name": "Gemma 4 E2B IT (Q4_0, 2.2 GB)",
                        "context": "8k",
                        "tools": True,
                    },
                ],
            },
        ],
    }

async def generate_summary(messages: list[dict[str, Any]]) -> str:
    """Generate a dense background summary for conversation compaction."""
    transcript_lines = []
    for m in messages:
        role = m.get("role", "user")
        content = str(m.get("content", ""))
        transcript_lines.append(f"{role}: {content}")
    transcript = "\n".join(transcript_lines)

    prompt = (
        "Summarize the key facts, user preferences, and topics discussed in this conversation in 3-5 concise sentences:\n"
        f"{transcript}"
    )

    summary_tokens = []
    for token in stream_chat(prompt=prompt, history=[], tools_enabled=False):
        summary_tokens.append(token)
    return "".join(summary_tokens).strip()

def stream_chat(
    prompt: str,
    history: list[dict[str, Any]],
    image: str | None = None,
    provider: str | None = None,
    model: str | None = None,
    tools_enabled: bool = True,
    max_tool_rounds: int = 20,
    on_tool_activity: Callable[[str, str], None] | None = None,
    cancel_event: threading.Event | None = None,
) -> Generator[str, None, None]:
    """Uniform multi-provider streaming generator supporting Mistral and llama.cpp Gemma 4."""
    prov = (provider or _active_provider).lower().strip()
    active_m = model or _active_model

    if prov in ("llama_cpp", "llamacpp", "gemma"):
        yield from stream_chat_llamacpp(
            prompt=prompt,
            history=history,
            image=image,
            model=active_m,
            base_url=_runtime_llamacpp_url,
            api_key=_runtime_api_keys.get("llama_cpp"),
            tools_enabled=tools_enabled,
            max_tool_rounds=max_tool_rounds,
            on_tool_activity=on_tool_activity,
            cancel_event=cancel_event,
        )
    else:
        yield from stream_chat_mistral(
            prompt=prompt,
            history=history,
            image=image,
            model=active_m,
            api_key=_runtime_api_keys.get("mistral") or config.MISTRAL_API_KEY,
            tools_enabled=tools_enabled,
            max_tool_rounds=max_tool_rounds,
            on_tool_activity=on_tool_activity,
            cancel_event=cancel_event,
        )
