from __future__ import annotations
import logging
from typing import Any
import numpy as np

from src import config

logger = logging.getLogger(__name__)

_model: Any | None = None

def get_model() -> Any:
    """Lazy initialization of the single shared faster-whisper model instance."""
    global _model
    if _model is None:
        try:
            from faster_whisper import WhisperModel
            logger.info(
                "Loading faster-whisper model '%s' (device=%s, compute_type=%s)...",
                config.WHISPER_MODEL,
                config.WHISPER_DEVICE,
                config.WHISPER_COMPUTE_TYPE,
            )
            _model = WhisperModel(
                config.WHISPER_MODEL,
                device=config.WHISPER_DEVICE,
                compute_type=config.WHISPER_COMPUTE_TYPE,
            )
            logger.info("faster-whisper model loaded successfully.")
        except Exception as e:
            logger.warning("faster-whisper could not be loaded: %s", e)
            _model = None
    return _model

def is_audio_silent(audio: np.ndarray, threshold: float = 0.003) -> bool:
    """Check if normalized float32 audio chunk is near-zero silence."""
    if audio.size == 0:
        return True
    rms = float(np.sqrt(np.mean(audio**2)))
    return rms < threshold

def transcribe_stream_interim(audio: np.ndarray) -> str:
    """Fast interim transcription during active speech (runs every ~500ms)."""
    if is_audio_silent(audio):
        return ""

    model = get_model()
    if model is None:
        return ""

    try:
        segments, _ = model.transcribe(
            audio,
            language="en",
            beam_size=1,
            temperature=0,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=250),
            without_timestamps=True,
        )
        return " ".join(s.text.strip() for s in segments).strip()
    except Exception as e:
        logger.debug("Interim ASR transcription error: %s", e)
        return ""

def transcribe_stream_final(audio: np.ndarray) -> str:
    """Final high-accuracy transcription when recording stops."""
    if is_audio_silent(audio):
        return ""

    model = get_model()
    if model is None:
        return ""

    try:
        segments, _ = model.transcribe(
            audio,
            language="en",
            beam_size=2,
            temperature=0,
            vad_filter=True,
            without_timestamps=True,
        )
        return " ".join(s.text.strip() for s in segments).strip()
    except Exception as e:
        logger.error("Final ASR transcription error: %s", e)
        return ""
