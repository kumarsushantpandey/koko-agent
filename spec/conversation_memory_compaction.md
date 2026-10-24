# Conversation Memory Compaction & Context Preservation Architecture

**Date:** 2026-10-24  
**Status:** Implemented & Verified  
**Related Files:**  
- `./server/src/llm/compactor.py`
- `./server/src/chat/loop.py`
- `./server/src/llm/provider.py`
- `./server/src/config.py`

---

## 1. Overview & Problem Statement

In long conversational sessions with multimodal AI companions, conversational history grows monotonically. In uncompacted conversation loops:
1. **Token Exhaustion**: Foundation model context limits (e.g. 32k for Qwen 7B, 16k for legacy endpoints) are eventually exceeded, causing API rejection errors.
2. **Context Drift**: Excessive historical turns dilute the assistant's attention, degrading persona consistency and tsundere behavioral dynamics.
3. **Escalating Latency & Cost**: Passing dozens of turns increases time-to-first-token (TTFT) and token consumption on every turn.
4. **Naive Truncation Flaws**: Simple sliding-window truncation drops user preferences, names, prior agreements, and emotional continuity, breaking companion immersion.

---

## 2. Architecture: Summary Buffer Memory Pattern

The system implements a **Summary Buffer Memory** pattern (`./server/src/llm/compactor.py`), balancing recent verbatim conversational fidelity with dense, objective background memory.

```
Full History (16+ Messages):
[ Turn 1: User & Assistant ] ─┐
[ Turn 2: User & Assistant ]  │
[ Turn 3: User & Assistant ]  ├─► Summarization Prompt ─► [ Objective Background Summary ]
[ Turn 4: User & Assistant ]  │                              │
[ Turn 5: User & Assistant ] ─┘                              │
                                                             ▼
[ Turn 6: User & Assistant ] ─── (Preserved Verbatim) ──► [ UserMessage(Background Memory) ]
[ Turn 7: User & Assistant ] ─── (Preserved Verbatim) ──► [ AssistantMessage("Understood.") ]
[ Turn 8: User & Assistant ] ─── (Preserved Verbatim) ──► [ Recent Turns 6, 7, 8 ]
```

### 2.1 Threshold Gating
Compaction is strictly lazy and bypasses normal turns with 0ms latency overhead:
- `COMPACTION_THRESHOLD_MESSAGES = 16` (~8 complete conversational turns).
- `COMPACTION_THRESHOLD_CHARS = 8000` (~2,000 tokens).

Turns 1 through 7 execute immediately without invoking the summarizer.

### 2.2 Recency Preservation
- `KEEP_RECENT_MESSAGES = 6` (~3 recent turns) are retained untouched in their original verbatim sequence.
- This guarantees immediate pronoun references ("that link you checked", "the calculation earlier"), recent tool outputs, and conversational momentum remain 100% accurate.

### 2.3 Cumulative Background Memory
Older turns are serialized into a dialogue transcript:
```python
lines = []
for role, text in older_messages:
    speaker = "User" if role == "user" else "Akari"
    lines.append(f"{speaker}: {text}")
transcript_str = "\n".join(lines)
```

The active LLM generates an objective, information-dense summary preserving:
1. Facts about {{user}} (name, preferences, habits, location).
2. Key topics discussed and outcomes reached.
3. Pending tasks or ongoing conversational threads.
4. Significant emotional milestones.

The compressed context is injected into history:
```python
compacted_history = [
    UserMessage(content=f"[Context from earlier conversation:\n{summary_text}\n(This is background memory - do not repeat it, just remember it.)]"),
    AssistantMessage(content="[Understood, I remember everything we talked about.]"),
] + recent_messages
```

---

## 3. Modality Boundary & History Sanitization

When multimodal vision is used in a conversation turn, client images are transmitted as large base64 Data URIs (`data:image/jpeg;base64,...`). Storing these Data URIs directly in history causes:
1. Massive token consumption across all subsequent turns.
2. Immediate HTTP 400 crashes when switching from a vision model (e.g. `pixtral-12b`) to a text-only model (e.g. `openai.gpt-oss-120b` or `qwen7b`) on Amazon Bedrock Mantle (`Model does not support image modality`).

### The Solution:
In `./server/src/chat/loop.py`:
```python
history_text = user_text
if image:
    history_text = f"[Image attached] {user_text}".strip() if user_text else "[Image attached]"
_history.append(UserMessage(content=history_text))
```
Only plain text descriptors are preserved in historical state. Only the active, immediate turn passes native base64 payloads to multimodal APIs.

---

## 4. Fail-Safe Recovery Mechanism

If the background summarization API call fails, encounters network timeouts, or throws an authentication error:
1. The compactor catches the exception safely.
2. It falls back immediately to a sliding-window truncation, preserving the most recent `KEEP_RECENT_MESSAGES`.
3. The conversation continues without crashing the user session or breaking chat streaming.

---

## 5. Verification & Benchmark

- **Test**: Simulated 24-turn continuous chat conversation.
- **Result**:
  - Turns 1–7: Fast streaming (TTFT ~240ms). History grew to 14 messages.
  - Turn 8 (16 messages reached): Triggered background compaction asynchronously. History reduced from 16 to 8 messages (2 background memory headers + 6 recent turns).
  - Turn 9: Fast streaming restored. Model accurately recalled the user's name ("Lakshya") and earlier discussion topics while maintaining persona.
