# Phase 01: Project Scaffolding & Environment Setup
**Task**: Scaffold the two-tier repository architecture, configure TypeScript/Vite client and Python/uv server environments, and verify baseline smoke tests.  
**Related Phase**: `./docs/implementation/00_master_roadmap_and_architecture.md`

---

## 1. Context & Architecture Goal

The project is structured into two independent halves:
- **`./client/`**: React 19 + TypeScript + Vite + Tailwind CSS web application rendering the 3D VRM character and glassmorphic UI.
- **`./server/`**: Python 3.11+ asynchronous backend managing WebSocket connections, Whisper speech recognition, LLM provider routing, and audio synthesis.

```
./
├── client/              # React 19 + Three.js Frontend
├── server/              # Python 3.11+ Asyncio Backend
├── docs/                # Architecture context and implementation roadmaps
├── spec/                # Engineering specifications and learnings
└── GUIDLINES.md         # Repository engineering guidelines
```

---

## 2. Agent Skill & Implementation Prompt

When delegating this scaffolding phase to an AI agent, use the following prompt:

```markdown
Scaffold a dual-tier full-stack application for a 3D VRM AI Companion:
1. Initialize `./client/` with Vite, React 19, TypeScript, Tailwind CSS, Three.js (`three`), `@pixiv/three-vrm`, `@pixiv/three-vrm-animation`, `@react-three/fiber`, `@react-three/drei`, and `@tabler/icons-react`.
2. Initialize `./server/` with Python 3.11+ using `uv`. Include `websockets`, `faster-whisper`, `numpy`, `python-dotenv`, `requests`, `aiohttp`, `openai`, `mistralai`, `sounddevice`, `soundfile`, and `scipy`.
3. Configure `.env.example` with placeholders for AWS Bedrock Bearer Token, OpenAI API key, Mistral API key, Fish Audio API key, and Tavily API key.
4. Establish clean project guidelines in `GUIDLINES.md` requiring relative path references (`./...`).
5. Verify both client build (`tsc -b && vite build`) and python dependencies (`uv sync`).
```

---

## 3. Client Scaffolding (`./client/`)

### 3.1 Initialize Package Configuration (`./client/package.json`)

```json
{
  "name": "client",
  "private": true,
  "version": "1.0.0",
  "license": "GPL-3.0-only",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "oxlint",
    "preview": "vite preview"
  },
  "dependencies": {
    "@pixiv/three-vrm": "^3.5.5",
    "@pixiv/three-vrm-animation": "^3.5.5",
    "@react-three/drei": "^10.7.7",
    "@react-three/fiber": "^9.7.0",
    "@react-three/postprocessing": "^3.0.4",
    "@tabler/icons-react": "^3.48.0",
    "@tailwindcss/vite": "^4.3.3",
    "leva": "^0.10.1",
    "phonemize": "^2.0.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "tailwindcss": "^4.3.3",
    "three": "^0.185.1"
  },
  "devDependencies": {
    "@types/bun": "^1.3.14",
    "@types/node": "^24.13.3",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.4",
    "oxlint": "^1.75.0",
    "typescript": "~6.0.2",
    "vite": "^8.2.0"
  }
}
```

### 3.2 Vite Configuration (`./client/vite.config.ts`)

> [!IMPORTANT]
> To prevent Windows Node.js file-watchers from throwing `UVException EBUSY: resource busy or locked` when inspecting 20MB+ `.vrm` binary assets, configure `server.watch.ignored`.

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      ignored: ['**/*.vrm', '**/characters/**', '**/public/characters/**'],
    },
  },
})
```

### 3.3 TypeScript Configuration (`./client/tsconfig.json`)

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

---

## 4. Server Scaffolding (`./server/`)

### 4.1 Python Package Configuration (`./server/pyproject.toml`)

```toml
[project]
name = "akari-server"
version = "1.0.0"
description = "Asynchronous Python backend for 3D VRM AI Companion"
requires-python = ">=3.11"
dependencies = [
    "websockets>=13.0",
    "faster-whisper>=1.0.0",
    "numpy>=1.26.0",
    "python-dotenv>=1.0.0",
    "requests>=2.31.0",
    "aiohttp>=3.9.0",
    "openai>=1.50.0",
    "mistralai>=1.0.0",
    "sounddevice>=0.4.6",
    "soundfile>=0.12.1",
    "scipy>=1.11.0",
    "python-dateutil>=2.8.2",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

### 4.2 Central Configuration (`./server/src/config.py`)

```python
from __future__ import annotations
import os
from dotenv import load_dotenv

load_dotenv()

# Network
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8765"))

# Mode: True = Browser Chat Mode, False = Server Mic Stream Mode
ENABLE_CHAT_INPUT = os.getenv("ENABLE_CHAT_INPUT", "True").lower() == "true"

# LLM Defaults
DEFAULT_LLM_PROVIDER = os.getenv("DEFAULT_LLM_PROVIDER", "mistral")
DEFAULT_LLM_MODEL = os.getenv("DEFAULT_LLM_MODEL", "ministral-8b-latest")
CHAT_TEMPERATURE = float(os.getenv("CHAT_TEMPERATURE", "0.7"))
TOOL_TEMPERATURE = float(os.getenv("TOOL_TEMPERATURE", "0.2"))

# Tool Calling
TOOL_CALLING_ENABLED = os.getenv("TOOL_CALLING_ENABLED", "True").lower() == "true"
MAX_TOOL_CALL_ROUNDS = int(os.getenv("MAX_TOOL_CALL_ROUNDS", "20"))
TOOL_EXECUTION_TIMEOUT = float(os.getenv("TOOL_EXECUTION_TIMEOUT", "10.0"))

# Emotion & Subtitles
ENABLE_SUBTITLES = os.getenv("ENABLE_SUBTITLES", "True").lower() == "true"
EMOTION_SYNC_MODE = os.getenv("EMOTION_SYNC_MODE", "synced")
```

### 4.3 Environment Variable Template (`./server/.env.example`)

```ini
# Server Network
HOST=127.0.0.1
PORT=8765
ENABLE_CHAT_INPUT=True

# AWS Bedrock Mantle
AWS_BEARER_TOKEN_BEDROCK="bedrock-api-key-..."
BEDROCK_REGION="ap-south-1"

# LLM Providers
MISTRAL_API_KEY="your_mistral_api_key"
OPENAI_API_KEY="your_openai_api_key"
OPENROUTER_API_KEY="your_openrouter_api_key"

# Web Search
TAVILY_API_KEY="tvly-..."

# Speech & Voice
TTS_BACKEND="fish"
FISH_AUDIO_API_KEY="your_fish_audio_api_key"
FISH_VOICE_ID="your_voice_id"
WHISPER_MODEL="small.en"

# Tools
TOOL_CALLING_ENABLED=True
MAX_TOOL_CALL_ROUNDS=20
```

---

## 5. Verification & Testing Instructions

### 5.1 Client Build Verification
In `./client/`:
```bash
bun install
bun run build
```
**Expected Output**:
```
✓ 6800+ modules transformed.
dist/index.html                     0.45 kB
dist/assets/index.css              56.89 kB
dist/assets/index.js             5,305.33 kB
✓ built in ~12s
```
Ensure there are **zero TypeScript compilation errors**.

### 5.2 Server Environment Verification
In `./server/`:
```bash
uv sync
uv run python -c "import websockets, openai, mistralai, faster_whisper, numpy; print('Server dependencies OK')"
```
**Expected Output**:
`Server dependencies OK`
