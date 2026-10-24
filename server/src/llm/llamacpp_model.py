from __future__ import annotations
import json
import logging
import threading
from typing import Any, Callable, Generator
from openai import OpenAI

from src import config
from src.prompts.system_prompt_koko import get_koko_system_prompt
from src.tools.registry import tool_registry

logger = logging.getLogger(__name__)

def get_llamacpp_client(base_url: str | None = None, api_key: str | None = None) -> OpenAI:
    """llama.cpp exposes a high-performance OpenAI-compatible HTTP server."""
    url = (base_url or config.LLAMACPP_BASE_URL).rstrip("/")
    if not url.endswith("/v1"):
        url = f"{url}/v1"
    key = api_key or config.LLAMACPP_API_KEY
    return OpenAI(base_url=url, api_key=key)

def _format_messages(
    prompt: str,
    history: list[dict[str, Any]],
    image: str | None = None,
    tools_enabled: bool = True,
) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": get_koko_system_prompt(tools_enabled=tools_enabled)}
    ]

    for item in history:
        role = item.get("role", "user")
        content = item.get("content", "")
        if isinstance(content, list):
            text_parts = [p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text"]
            content = " ".join(filter(None, text_parts)).strip() or "[Image attached]"
        elif not isinstance(content, str):
            content = str(content)
        messages.append({"role": role, "content": content})

    if image:
        # For Gemma 4, if vision is supported
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

def stream_chat_llamacpp(
    prompt: str,
    history: list[dict[str, Any]],
    image: str | None = None,
    model: str | None = None,
    base_url: str | None = None,
    api_key: str | None = None,
    tools_enabled: bool = True,
    max_tool_rounds: int = 20,
    on_tool_activity: Callable[[str, str], None] | None = None,
    cancel_event: threading.Event | None = None,
) -> Generator[str, None, None]:
    """Stream chat responses from local or remote llama.cpp server running Gemma 4 with native function calling."""
    client = get_llamacpp_client(base_url, api_key)
    active_model = model or config.LLAMACPP_MODEL
    messages = _format_messages(prompt, history, image, tools_enabled=tools_enabled)

    rounds = 0
    while rounds < max_tool_rounds:
        if cancel_event and cancel_event.is_set():
            logger.info("llama.cpp streaming cancelled by user interrupt.")
            break

        rounds += 1
        tools = tool_registry.get_openai_tools() if tools_enabled else None

        try:
            kwargs: dict[str, Any] = {
                "model": active_model,
                "messages": messages,
                "temperature": config.CHAT_TEMPERATURE if rounds == 1 else config.TOOL_TEMPERATURE,
                "stream": True,
            }
            if tools:
                kwargs["tools"] = tools
                kwargs["tool_choice"] = "auto"

            response = client.chat.completions.create(**kwargs)
        except Exception as e:
            logger.error("llama.cpp server error on round %d: %s", rounds, e)
            yield f"[angry] B-Baka! llama.cpp server at {base_url or config.LLAMACPP_BASE_URL} failed: {e}. Is llama.cpp running?"
            return

        tool_calls_acc: dict[int, dict[str, Any]] = {}
        content_acc = ""

        for chunk in response:
            if cancel_event and cancel_event.is_set():
                break

            delta = chunk.choices[0].delta if chunk.choices else None
            if not delta:
                continue

            if delta.content:
                content_acc += delta.content
                yield delta.content

            if delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index
                    if idx not in tool_calls_acc:
                        tool_calls_acc[idx] = {
                            "id": tc.id or f"call_{idx}",
                            "name": tc.function.name if tc.function and tc.function.name else "",
                            "arguments": "",
                        }
                    else:
                        if tc.function and tc.function.name:
                            tool_calls_acc[idx]["name"] = tc.function.name
                    if tc.function and tc.function.arguments:
                        tool_calls_acc[idx]["arguments"] += tc.function.arguments

        if not tool_calls_acc:
            break

        assistant_tool_msg = {
            "role": "assistant",
            "content": content_acc or None,
            "tool_calls": [
                {
                    "id": tc_data["id"],
                    "type": "function",
                    "function": {"name": tc_data["name"], "arguments": tc_data["arguments"]},
                }
                for tc_data in tool_calls_acc.values()
            ],
        }
        messages.append(assistant_tool_msg)

        import asyncio
        loop = asyncio.new_event_loop()
        try:
            for tc_data in tool_calls_acc.values():
                call_id = tc_data["id"]
                tool_name = tc_data["name"]
                raw_args = tc_data["arguments"]

                try:
                    args = json.loads(raw_args) if raw_args else {}
                except Exception:
                    args = {}

                if on_tool_activity:
                    on_tool_activity("tool_start", tool_name)

                result = loop.run_until_complete(tool_registry.execute_tool(tool_name, args))

                if on_tool_activity:
                    on_tool_activity("tool_end", tool_name)

                messages.append({
                    "role": "tool",
                    "tool_call_id": call_id,
                    "name": tool_name,
                    "content": json.dumps(result),
                })
        finally:
            loop.close()
