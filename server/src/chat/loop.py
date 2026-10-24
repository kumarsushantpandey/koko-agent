from __future__ import annotations
import asyncio
import logging
import re
import threading
from typing import Any

from src import config
from src.bridge.broadcaster import broadcaster
from src.llm import stream_chat, compact_conversation_async, generate_summary, analyze_image
from src.tts import synthesize_sentence, wav_to_data_uri
from src.voice import split_dialogue_units_with_emotions, strip_all_emotion_tags

logger = logging.getLogger(__name__)

# Active session history
_conversation_history: list[dict[str, Any]] = []
_active_cancel_event: threading.Event | None = None
_active_task: asyncio.Task | None = None

def get_conversation_history() -> list[dict[str, Any]]:
    return _conversation_history

def clear_conversation_history():
    global _conversation_history
    _conversation_history = []
    logger.info("Conversation history cleared.")

async def stop_chat_stream():
    """Immediately halt any active LLM generation, tool execution, or TTS dispatch."""
    global _active_cancel_event, _active_task
    was_active = False
    if _active_cancel_event and not _active_cancel_event.is_set():
        _active_cancel_event.set()
        was_active = True
    if _active_task and not _active_task.done():
        _active_task.cancel()
        was_active = True
    if was_active:
        logger.info("Interrupt received: stopping active chat stream.")
        # Reset face and state on client only if an actual stream was interrupted
        await broadcaster.broadcast_json({"type": "speech_end"})
        await broadcaster.broadcast_json({"type": "turn_end"})

async def process_chat_message(
    text: str,
    image: str | None = None,
    provider: str | None = None,
    model: str | None = None,
    tools_enabled: bool = True,
    timezone: str | None = None,
):
    """Main conversational processing loop:

    Compaction -> LLM Streaming -> Sentence Chunker -> Parallel TTS -> WebSocket Dispatch.
    """
    global _active_cancel_event, _active_task, _conversation_history

    # Cancel any previous ongoing stream
    await stop_chat_stream()

    cancel_event = threading.Event()
    _active_cancel_event = cancel_event

    task = asyncio.current_task()
    _active_task = task

    try:
        # Step 1: Compaction check
        _conversation_history = await compact_conversation_async(
            _conversation_history,
            summarizer_fn=generate_summary,
        )

        # Append incoming user prompt
        user_message: dict[str, Any] = {"role": "user", "content": text}
        _conversation_history.append(user_message)

        # Notify client thinking has started
        await broadcaster.broadcast_json({"type": "thinking_start"})
        await broadcaster.broadcast_json({"type": "transcript", "text": text})

        loop = asyncio.get_running_loop()

        def on_tool_activity(event_type: str, tool_name: str):
            asyncio.run_coroutine_threadsafe(
                broadcaster.broadcast_json({"type": event_type, "tool": tool_name, "tool_name": tool_name}),
                loop,
            )

        # Run LLM streaming generator on background thread
        token_queue: asyncio.Queue[str | None] = asyncio.Queue()

        def _run_generator():
            try:
                for token in stream_chat(
                    prompt=text,
                    history=_conversation_history[:-1],
                    image=image,
                    provider=provider,
                    model=model,
                    tools_enabled=tools_enabled,
                    max_tool_rounds=config.MAX_TOOL_CALL_ROUNDS,
                    on_tool_activity=on_tool_activity,
                    cancel_event=cancel_event,
                ):
                    if cancel_event.is_set():
                        break
                    loop.call_soon_threadsafe(token_queue.put_nowait, token)
            except Exception as e:
                logger.error("Error in LLM generator: %s", e)
                loop.call_soon_threadsafe(token_queue.put_nowait, f"[angry] Error: {e}")
            finally:
                loop.call_soon_threadsafe(token_queue.put_nowait, None)

        gen_thread = threading.Thread(target=_run_generator, daemon=True)
        gen_thread.start()

        full_response_text = ""
        accumulator = ""
        speech_started = False
        segment_index = 0
        terminal_punct = re.compile(r"([.!?\n])")

        await broadcaster.broadcast_json({"type": "thinking_end"})

        # Stream tokens and accumulate sentence units
        while True:
            if cancel_event.is_set():
                break

            token = await token_queue.get()
            if token is None:
                # End of stream
                break

            full_response_text += token
            accumulator += token

            # Check if accumulator contains a complete sentence chunk
            if terminal_punct.search(accumulator):
                words = accumulator.split()
                # Ensure we have at least 3 words or a clear terminal mark
                if len(words) >= 3 or "\n" in accumulator:
                    units = split_dialogue_units_with_emotions(accumulator)
                    if units:
                        if not speech_started:
                            speech_started = True
                            await broadcaster.broadcast_json({"type": "speech_start"})

                        for unit_text, unit_emotion in units:
                            if cancel_event.is_set():
                                break

                            clean_speech = strip_all_emotion_tags(unit_text)
                            if not clean_speech:
                                continue

                            wav_bytes = await synthesize_sentence(clean_speech)
                            data_uri = wav_to_data_uri(wav_bytes)

                            await broadcaster.broadcast_json({
                                "type": "speech_segment",
                                "text": clean_speech,
                                "raw_text": unit_text,
                                "audio": data_uri,
                                "emotion": unit_emotion,
                                "segment_index": segment_index,
                                "is_last": False,
                            })
                            segment_index += 1

                        accumulator = ""

        # Flush any remaining accumulated text
        if accumulator.strip() and not cancel_event.is_set():
            units = split_dialogue_units_with_emotions(accumulator)
            if units:
                if not speech_started:
                    speech_started = True
                    await broadcaster.broadcast_json({"type": "speech_start"})

                for unit_text, unit_emotion in units:
                    clean_speech = strip_all_emotion_tags(unit_text)
                    if not clean_speech:
                        continue

                    wav_bytes = await synthesize_sentence(clean_speech)
                    data_uri = wav_to_data_uri(wav_bytes)

                    await broadcaster.broadcast_json({
                        "type": "speech_segment",
                        "text": clean_speech,
                        "raw_text": unit_text,
                        "audio": data_uri,
                        "emotion": unit_emotion,
                        "segment_index": segment_index,
                        "is_last": True,
                    })
                    segment_index += 1

        # Record assistant reply into session history
        if full_response_text.strip():
            _conversation_history.append({"role": "assistant", "content": full_response_text.strip()})

    except asyncio.CancelledError:
        logger.info("Chat loop task cancelled.")
    except Exception as e:
        logger.exception("Error in process_chat_message: %s", e)
    finally:
        await broadcaster.broadcast_json({"type": "turn_end"})
