from __future__ import annotations
import logging
from typing import Any, Callable

logger = logging.getLogger(__name__)

COMPACTION_THRESHOLD_MESSAGES = 16  # ~8 conversational turns
COMPACTION_THRESHOLD_CHARS = 8000
KEEP_RECENT_MESSAGES = 6            # Retain recent 3 turns verbatim

def should_compact(history: list[dict[str, Any]]) -> bool:
    """Determine whether conversation history exceeds length or token threshold."""
    if len(history) >= COMPACTION_THRESHOLD_MESSAGES:
        return True
    total_chars = sum(len(str(m.get("content", ""))) for m in history)
    return total_chars >= COMPACTION_THRESHOLD_CHARS

async def compact_conversation_async(
    history: list[dict[str, Any]],
    summarizer_fn: Callable[[list[dict[str, Any]]], Any] | None = None,
) -> list[dict[str, Any]]:
    """Compacts older messages into a dense background memory block while preserving recent turns."""
    if not should_compact(history):
        return history

    older_messages = history[:-KEEP_RECENT_MESSAGES]
    recent_messages = history[-KEEP_RECENT_MESSAGES:]

    summary_text = ""
    if summarizer_fn:
        try:
            summary_text = await summarizer_fn(older_messages)
        except Exception as e:
            logger.warning("Compactor summarization failed (%s). Falling back to sliding window.", e)

    if not summary_text:
        # Fallback: create concise point-by-point transcript digest
        lines = []
        for m in older_messages[-8:]:
            role = m.get("role", "user")
            content = str(m.get("content", ""))[:120].strip()
            if content:
                lines.append(f"{role}: {content}")
        summary_text = "; ".join(lines)

    compacted = [
        {
            "role": "user",
            "content": f"[Context from earlier conversation:\n{summary_text}\n(Background memory)]",
        },
        {
            "role": "assistant",
            "content": "[Understood! I remember everything we talked about.]",
        },
    ] + recent_messages

    logger.info("Conversation compacted from %d turns to %d turns.", len(history), len(compacted))
    return compacted
