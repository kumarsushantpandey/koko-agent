from __future__ import annotations
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from the server root directory
server_root = Path(__file__).resolve().parent.parent
load_dotenv(server_root / ".env")

# --- Network & Server Settings ---
HOST: str = os.getenv("HOST", "127.0.0.1")
PORT: int = int(os.getenv("PORT", "8765"))

# Operation Mode: True = Browser Chat Mode (Only mode supported)
ENABLE_CHAT_INPUT: bool = os.getenv("ENABLE_CHAT_INPUT", "True").lower() == "true"

# --- LLM Providers (Mistral AI & llama.cpp Gemma 4) ---
DEFAULT_LLM_PROVIDER: str = os.getenv("DEFAULT_LLM_PROVIDER", "mistral").lower()

# Mistral AI
MISTRAL_API_KEY: str = os.getenv("MISTRAL_API_KEY", "")
DEFAULT_MISTRAL_MODEL: str = os.getenv("DEFAULT_MISTRAL_MODEL", "ministral-8b-latest")

# llama.cpp (Gemma 4 native function calling)
LLAMACPP_BASE_URL: str = os.getenv("LLAMACPP_BASE_URL", "http://127.0.0.1:8080/v1")
LLAMACPP_MODEL: str = os.getenv("LLAMACPP_MODEL", "ggml-org/gemma-4-E2B-it-GGUF:Q4_0")
LLAMACPP_API_KEY: str = os.getenv("LLAMACPP_API_KEY", "not-needed")

# LLM Generation Parameters
CHAT_TEMPERATURE: float = float(os.getenv("CHAT_TEMPERATURE", "0.7"))
TOOL_TEMPERATURE: float = float(os.getenv("TOOL_TEMPERATURE", "0.2"))

# --- Agentic Tool Calling ---
TOOL_CALLING_ENABLED: bool = os.getenv("TOOL_CALLING_ENABLED", "True").lower() == "true"
MAX_TOOL_CALL_ROUNDS: int = int(os.getenv("MAX_TOOL_CALL_ROUNDS", "20"))
TOOL_EXECUTION_TIMEOUT: float = float(os.getenv("TOOL_EXECUTION_TIMEOUT", "15.0"))

# Search & Web Reader APIs
TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY", "")

# --- Speech Recognition (ASR) ---
WHISPER_MODEL: str = os.getenv("WHISPER_MODEL", "small.en")
WHISPER_DEVICE: str = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

# --- Text-to-Speech (TTS) ---
TTS_BACKEND: str = os.getenv("TTS_BACKEND", "fish")
FISH_AUDIO_API_KEY: str = os.getenv("FISH_AUDIO_API_KEY", "")
FISH_VOICE_ID: str = os.getenv("FISH_VOICE_ID", "")
FISH_AUDIO_MODEL: str = os.getenv("FISH_AUDIO_MODEL", "s2.1-pro-free")

# --- Subtitles & Emotion Sync ---
ENABLE_SUBTITLES: bool = os.getenv("ENABLE_SUBTITLES", "True").lower() == "true"
EMOTION_SYNC_MODE: str = os.getenv("EMOTION_SYNC_MODE", "synced")

# --- Computer-Use Tools ---
COMPUTER_TOOLS_ENABLED: bool = os.getenv("COMPUTER_TOOLS_ENABLED", "True").lower() == "true"
MAX_BASH_TIMEOUT: float = float(os.getenv("MAX_BASH_TIMEOUT", "30"))
MAX_FILE_READ_KB: int = int(os.getenv("MAX_FILE_READ_KB", "128"))
MAX_FILE_WRITE_KB: int = int(os.getenv("MAX_FILE_WRITE_KB", "512"))
# Comma-separated list of allowed root dirs (empty = unrestricted)
BASH_ALLOWED_DIRS: str = os.getenv("BASH_ALLOWED_DIRS", "")
FILE_ALLOWED_DIRS: str = os.getenv("FILE_ALLOWED_DIRS", "")
