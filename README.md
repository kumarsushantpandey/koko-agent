# Koko AI — Multimodal 3D VRM Anime Assistant

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](./LICENSE)
[![Runtime: Node / Bun](https://img.shields.io/badge/Client-React%2019%20%2B%20Three.js-pink.svg)](./client)
[![Backend: Python 3.12](https://img.shields.io/badge/Server-Python%203.12%20%2B%20uv-purple.svg)](./server)

**Koko AI** is an interactive, low-latency conversational 3D VRM anime companion. She features an energetic, tsundere, gamer, and tech-geek personality, rendered in 60 FPS WebGL with real-time audio-reactive lip-sync, synchronized facial expressions, and agentic tool intelligence.

---

## 🌟 Key Features

- **3D Anime Avatar Engine**: WebGL rendering with Three.js, React Three Fiber, procedural eye blinking, breathing oscillation, and camera tracking.
- **Audio-Reactive Lip-Sync**: Zero-latency Web Audio `AnalyserNode` FFT frequency energy mapping directly to mouth blendshapes (`aa`, `ih`, `ou`, `ee`, `oh`).
- **Synchronized Facial Expressions**: Audio-time emotion binding triggering the 6 core VRM presets (`Happy`, `Sad`, `Angry`, `Surprised`, `Relaxed`, `Neutral`) the exact millisecond spoken audio begins.
- **Dedicated Foundation Model Gateways**:
  - **Mistral AI**: Remote API (`ministral-8b-latest`, `pixtral-12b-2409`, `mistral-small-latest`).
  - **llama.cpp (Gemma 4)**: Local or remote high-performance inference with native function calling.
- **12 Agentic Built-in Tools**: 20-round multi-turn execution covering dynamic tool discovery (`get_available_tools`), real-time clock and worldwide timezones, AST math, host system health, and live web search/reader.
- **Multimodal Vision**: Client offscreen canvas compression (1280x1280 JPEG 0.85) with camera capture, drag-and-drop, and clipboard screenshot pasting (`Ctrl+V`).
- **Memory Compaction**: Automatic summary buffer memory compaction preventing token drift during extended sessions.
- **Chat-Only Architecture**: Streamlined full-duplex WebSocket bridge (`ws://127.0.0.1:8765`) handling binary PCM mic streaming, typed JSON events, and instant interruptions.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** (v20+) or **Bun** (v1.2+)
- **Python** (3.11 or 3.12) with **uv** installed (`pip install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`)

### 2. Server Setup (`./server/`)
```bash
cd server

# Copy environment variables template
cp .env.example .env
# Edit .env and insert your MISTRAL_API_KEY (or configure llama.cpp URL)

# Install dependencies
uv sync

# Start Koko AI server
uv run python -m src.main
```
The server will start on `ws://127.0.0.1:8765`.

### 3. Client Setup (`./client/`)
```bash
cd client

# Install dependencies
bun install
# or: npm install

# Start development server
bun run dev
# or: npm run dev
```
Open `http://localhost:5173/` in your browser.

---

## 📁 Repository Structure

```
./
├── client/                     # React 19 + Three.js + Vite Web Application
│   ├── public/
│   │   ├── characters/         # 3D VRM Humanoid Models (default.vrm, Espeon.vrm)
│   │   ├── animations/         # .vrma & .bvh animation clips
│   │   └── koko_avatar.jpg     # Character preview avatars
│   └── src/
│       ├── audio/              # Web Audio AnalyserNode, AudioPlayer, SpeechQueue
│       ├── components/         # Character controllers, Scene, Subtitles, ChatInput
│       ├── navigation/         # Clean URL routing, Sidebar, Theme manager
│       └── networking/         # AvatarSocket, typed EventBus
│
├── server/                     # Asynchronous Python 3.12 Backend
│   ├── src/
│   │   ├── asr/                # Streaming Faster-Whisper ASR
│   │   ├── bridge/             # WebSocket server, Binary protocol, Broadcaster
│   │   ├── chat/               # Conversational loop, parallel TTS chunker, cancel
│   │   ├── llm/                # Mistral AI & llama.cpp Gemma 4 router, Compactor, Vision
│   │   ├── prompts/            # Koko AI Tsundere persona system prompt
│   │   ├── tools/              # 12 Built-in tools & resilient ToolRegistry
│   │   ├── tts/                # Fish Audio synthesis with synthetic fallback
│   │   └── voice/              # Sentence-level emotion partitioner & tag stripper
│   └── pyproject.toml          # uv package dependencies
│
├── docs/                       # Architectural context snapshots and implementation roadmaps
├── spec/                       # Engineering specifications and tested solutions
└── GUIDLINES.md                # Core repository engineering guidelines
```

---

## 📜 Guidelines & Standards

Whenever extending this codebase, adhere strictly to [GUIDLINES.md](./GUIDLINES.md):
- Always use relative file paths prefixed with `./` in all Markdown files.
- Document any new engineering discoveries or successfully tested approaches in `./spec/`.
- Maintain clean, modular code with strict domain isolation between character animation controllers and lip-sync blendshapes.

---

Built for Hacktoberfest Hack Day with ❤️.
