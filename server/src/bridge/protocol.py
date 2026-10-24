from __future__ import annotations

class BinaryPacket:
    """Header byte definitions for WebSocket binary framing."""
    AUDIO_CHUNK = 0x01      # Server -> Client: Synthesized audio bytes (WAV/PCM)
    AUDIO_END = 0x02        # Server -> Client: Audio stream completed for turn
    AUDIO_INTERRUPT = 0x03  # Bidirectional: Immediately cancel speech and generation
    VOICE_CHUNK = 0x10      # Client -> Server: 16kHz Int16 PCM audio chunk from microphone
    VOICE_END = 0x11        # Client -> Server: Recording stopped; trigger final ASR transcription pass
