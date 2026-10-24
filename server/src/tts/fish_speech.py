from __future__ import annotations
import base64
import io
import logging
import math
import wave
import aiohttp
from src import config

logger = logging.getLogger(__name__)

def _generate_synthetic_speech_wav(text: str) -> bytes:
    """Generate a lightweight synthetic PCM WAV audio buffer matching the approximate duration

    of the spoken text (approx 75ms per character). This enables instant offline testing
    and lip-sync FFT reactivity even before the user adds their Fish Audio API key.
    """
    sample_rate = 24000
    # Estimate duration: ~75ms per character, minimum 0.5s, maximum 5.0s
    duration_s = max(0.5, min(5.0, len(text) * 0.075))
    total_samples = int(sample_rate * duration_s)

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        wav_file.setnchannels(1)        # Mono
        wav_file.setsampwidth(2)       # 16-bit
        wav_file.setframerate(sample_rate)

        # Generate a gentle modulated audio wave that triggers the client FFT AnalyserNode
        frames = bytearray()
        for i in range(total_samples):
            t = float(i) / sample_rate
            # 220Hz carrier with 4Hz vocal amplitude envelope modulation
            carrier = math.sin(2.0 * math.pi * 220.0 * t)
            modulation = 0.5 * (1.0 + math.sin(2.0 * math.pi * 4.0 * t))
            val = int(carrier * modulation * 8000.0)
            # Clip to int16
            val = max(-32767, min(32767, val))
            frames.extend(val.to_bytes(2, byteorder="little", signed=True))

        wav_file.writeframes(frames)

    return buf.getvalue()

async def synthesize_sentence(text: str) -> bytes:
    """Synthesizes a single dialogue sentence into WAV audio bytes."""
    api_key = config.FISH_AUDIO_API_KEY
    voice_id = config.FISH_VOICE_ID

    if api_key and voice_id and config.TTS_BACKEND == "fish":
        url = "https://api.fish.audio/v1/tts"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "text": text,
            "reference_id": voice_id,
            "format": "wav",
            "latency": "balanced",
        }
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=10.0)) as resp:
                    if resp.status == 200:
                        return await resp.read()
                    else:
                        err_text = await resp.text()
                        logger.warning("Fish Audio API returned %d: %s. Using synthetic fallback.", resp.status, err_text)
        except Exception as e:
            logger.warning("Fish Audio synthesis failed (%s). Using synthetic fallback.", e)

    # Offline/keyless synthetic fallback
    return _generate_synthetic_speech_wav(text)

def wav_to_data_uri(wav_bytes: bytes) -> str:
    """Convert raw WAV audio bytes into a base64 Data URI."""
    encoded = base64.b64encode(wav_bytes).decode("ascii")
    return f"data:audio/wav;base64,{encoded}"
