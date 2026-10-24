from __future__ import annotations
import re

EMOTION_TAG_PATTERN = re.compile(r"\[([a-zA-Z_\-]+)\]", re.IGNORECASE)

# Mapping from emotion tag variants to the 6 core VRM presets
EMOTION_ALIASES: dict[str, str] = {
    "happy": "Happy",
    "blush": "Happy",
    "flustered": "Happy",
    "teasing": "Happy",
    "smirk": "Happy",
    "joy": "Happy",
    "excited": "Happy",
    "cheerful": "Happy",
    "proud": "Happy",
    "love": "Happy",

    "angry": "Angry",
    "annoyed": "Angry",
    "pouting": "Angry",
    "mad": "Angry",
    "furious": "Angry",
    "irritated": "Angry",

    "sad": "Sad",
    "sulky": "Sad",
    "crying": "Sad",
    "grief": "Sad",
    "remorse": "Sad",
    "depressed": "Sad",
    "unhappy": "Sad",

    "surprised": "Surprised",
    "shocked": "Surprised",
    "confused": "Surprised",
    "amazed": "Surprised",
    "realization": "Surprised",
    "fear": "Surprised",

    "relaxed": "Relaxed",
    "calm": "Relaxed",
    "sleepy": "Relaxed",
    "relief": "Relaxed",
    "chill": "Relaxed",

    "neutral": "Neutral",
}

def strip_all_emotion_tags(text: str) -> str:
    """Strip bracketed emotion tags and lone markdown asterisks."""
    if not text:
        return ""
    no_tags = EMOTION_TAG_PATTERN.sub("", text)
    no_asterisks = re.sub(r"\*+", "", no_tags)
    return " ".join(no_asterisks.split()).strip()

def split_dialogue_units_with_emotions(raw_text: str, max_words: int = 16) -> list[tuple[str, str]]:
    """Partition dialogue into sentence units while retaining the active 3D emotion tag for each unit.

    Returns a list of (sentence_text, emotion_name) tuples.
    """
    if not raw_text or not raw_text.strip():
        return []

    # Tokenize by emotion tags
    tokens = re.split(r"(\[[a-zA-Z_\-]+\])", raw_text, flags=re.IGNORECASE)
    current_emotion = "Neutral"
    sections: list[tuple[str, str]] = []

    for token in tokens:
        if not token:
            continue
        tag_match = EMOTION_TAG_PATTERN.fullmatch(token.strip())
        if tag_match:
            tag_name = tag_match.group(1).lower()
            current_emotion = EMOTION_ALIASES.get(tag_name, "Neutral")
        else:
            # Strip markdown action asterisks from dialogue
            clean_token = re.sub(r"\*+", "", token).strip()
            if clean_token:
                sections.append((clean_token, current_emotion))

    # Break sections into sentences at punctuation boundaries
    dialogue_units: list[tuple[str, str]] = []

    for section_text, emotion in sections:
        # Split at terminal punctuation (. ! ? \n)
        raw_sentences = re.split(r"(?<=[.!?\n])\s+", section_text)
        for s in raw_sentences:
            s_clean = s.strip()
            if not s_clean:
                continue

            words = s_clean.split()
            if len(words) <= max_words:
                dialogue_units.append((s_clean, emotion))
            else:
                # Break large sentences into chunks of max_words
                for i in range(0, len(words), max_words):
                    chunk = " ".join(words[i:i + max_words])
                    dialogue_units.append((chunk, emotion))

    return dialogue_units
