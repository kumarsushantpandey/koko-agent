# Sidebar, Screen Navigation & Dynamic Mode Specification

## 1. Overview & Objective

This specification details the architecture, visual design system, and client-server protocol for the **sidebar navigation, screen views (Overview, Chat, Stream, Gallery), synchronized theming, and dynamic conversation mode switching** in the Akari Watanabe AI assistant.

The primary design objectives are:
1. **Model-Centric Layout**: Provide persistent, low-noise navigation that keeps the 3D VRM avatar as the focal center of the experience.
2. **Minimal & Utility-Oriented Aesthetic**: Dark-first, restrained typography, thin borders, muted neutral surfaces, and zero visual clutter (no top bar, no oversized badges, no generic SaaS dashboard gradients).
3. **Unified Theming Engine**: Synchronize the sidebar, floating panels, text colors, and Three.js 3D scene (background, exponential fog, ambient and directional lights) via a shared React theme context.
4. **Dynamic Conversation Modes**: Replace static `config.py` flags with client-driven runtime mode switching:
   - **Chat Mode** (`ENABLE_CHAT_INPUT = True`): Browser UI drives conversation via text and Web voice input.
   - **Stream Mode** (`ENABLE_CHAT_INPUT = False`): Server voice loop listens to the host microphone, generates LLM dialogue & TTS, and streams speech segments to the browser.

---

## 2. Architecture & Data Flow

```
+----------------------------------------------------------------------------------------------------+
|                                         FRONTEND (React)                                           |
|                                                                                                    |
|   [ Sidebar (56px) ]                                                                               |
|   ├─ Characters (/?screen=characters) ──> OverviewScreen (Left Profile Card + Bottom Selector Row)|
|   ├─ Chat       (/?screen=chat)       ──> ChatScreen     (ChatInput + Raised Subtitles)            |
|   ├─ Stream     (/?screen=stream)     ──> StreamScreen   (Status Pill + Lower Subtitles)           |
|   ├─ Gallery    (/?screen=galary)     ──> GalleryScreen  (Right Metadata Card)                     |
|   └─ Theme Switcher (Sun / Moon)      ──> ThemeContext   ──> CSS Tokens + Three.js Scene           |
|                                                                                                    |
|   [ Navigation State ]                                                                             |
|   Active Screen Change ──> AvatarSocket.setMode(chat_input_enabled, screen)                         |
+----------------------------------------------------------------------------------------------------+
                                      |                     ^
                  { type: "set_mode" }|                     | { type: "config" },
                  { type: "chat_msg" }|                     | { type: "speech_segment" }
                                      v                     |
+----------------------------------------------------------------------------------------------------+
|                                         BACKEND (Python)                                           |
|                                                                                                    |
|   1. websocket_server.py:                                                                          |
|      - Receives { type: "set_mode", chat_input_enabled: bool }                                     |
|      - When True  (Chat Mode)   ──> stop_voice_loop()                                              |
|      - When False (Stream Mode) ──> start_voice_loop()                                             |
|                                                                                                    |
|   2. voice/loop.py (Stream Mode):                                                                  |
|      - Server Mic Capture (16kHz PCM with 20ms stop_event polling)                                 |
|      - Faster-Whisper ASR ──> Mistral LLM Stream ──> Dialogue Segmentation                         |
|      - Parallel TTS (Fish Audio) ──> Dispatches `speech_segment` to client                         |
|                                                                                                    |
|   3. chat/loop.py (Chat Mode):                                                                     |
|      - Handles incoming `chat_message` text or browser-streamed voice                              |
+----------------------------------------------------------------------------------------------------+
```

---

## 3. Visual Design System & Theming

### 3.1 Design Principles
- **Dark-First**: Muted neutrals with low surface contrast.
- **Compact & Restrained**: 56px fixed sidebar width, 12px/13px secondary text, 18px-24px icon sizes.
- **Thin Borders & Clean Surfaces**: 1px borders using subtle rgba/hex tokens (`#292929` dark, `#D1CFCA` light). No neon outlines.
- **No Heavy Glassmorphism or Gradients**: Solid, clean elevated surfaces (`#232623` dark, `#FFFFFF` light) to preserve 60 FPS WebGL rendering performance.
- **No Top Header Bar**: The top of the viewport remains clear to maximize 3D character framing.

### 3.2 Token System (`client/src/index.css`)

| Token | Dark Mode (`[data-theme="dark"]`) | Light Mode (`[data-theme="light"]`) | Usage |
| :--- | :--- | :--- | :--- |
| `--sidebar-width` | `56px` | `56px` | Persistent left navigation sidebar width |
| `--bg-canvas` | `#1A1C1C` | `#F7F7F5` | 3D WebGL canvas background & clear color |
| `--bg-sidebar` | `#121212` | `#E8E6DF` | Left navigation sidebar background |
| `--bg-surface` | `#1E201F` | `#FFFFFF` | Primary UI card / panel surfaces |
| `--bg-surface-elevated`| `#232623` | `#FAFAFA` | Elevated interactive controls & badges |
| `--bg-surface-subtle` | `#282A28` | `#EDEDE8` | Secondary tab buttons & inactive items |
| `--border-color` | `#292929` | `#D1CFCA` | Thin card and button borders |
| `--border-color-subtle`| `#222422` | `#E2E0DB` | Divider lines and sub-borders |
| `--text-primary` | `#F2F0E7` | `#1A1C1C` | Headings, active labels, character name |
| `--text-secondary` | `#A6A6A0` | `#5A5A55` | Body copy, subtitles, metadata |
| `--text-tertiary` | `#777874` | `#8C8C86` | Minor captions, indicators, timestamps |
| `--accent-indicator` | `#E05A47` | `#D44A37` | Sidebar active vertical bar, primary CTAs |
| `--color-success` | `#8FAF91` | `#4B8050` | Microphone live indicator, online dot |

### 3.3 Synchronized Three.js Environment (`client/src/components/scene.tsx`)
The 3D environment synchronizes in real time with the HTML/CSS theme:

```typescript
// Dark Mode Scene Configuration
scene.background = new THREE.Color("#1A1C1C");
scene.fog = new THREE.FogExp2("#1A1C1C", 0.05);
ambientLight.intensity = 0.6;
directionalLight.intensity = 1.2;

// Light Mode Scene Configuration
scene.background = new THREE.Color("#F7F7F5");
scene.fog = new THREE.FogExp2("#F7F7F5", 0.04);
ambientLight.intensity = 1.0;
directionalLight.intensity = 1.5;
```

---

## 4. Navigation Architecture & Screen Layouts

### 4.1 URL Route Contracts
Navigation state is managed via URL search parameters, supporting standard browser history and direct bookmarking:
- Overview: `/?screen=characters&character=akari`
- Chat: `/?screen=chat&character=akari`
- OpenSpace / Stream: `/?screen=stream&character=akari`
- Gallery: `/?screen=galary&character=akari` (Note: `galary` spelling preserved per project specification).

### 4.2 Sidebar (`client/src/navigation/Sidebar.tsx`)
- Fixed width: `56px`, height: `100vh`, `position: fixed; left: 0; top: 0; z-index: 100;`.
- Top menu icon (`IconMenu2`).
- 4 navigation icons in order:
  1. `characters`: `IconUserSquareRounded` (Overview)
  2. `chat`: `IconMessageCircle` (Chat)
  3. `stream`: `IconCube` (OpenSpace / Stream)
  4. `galary`: `IconCamera` (Gallery)
- Active indicator: A 3px vertical red bar (`--accent-indicator`) on the left edge and elevated dark container background (`#2B302B`).
- Bottom theme switcher: Dual vertical toggle with Sun on top (`IconSun`) and Moon on bottom (`IconMoon`).

### 4.3 Screen Components

#### 1. Overview Screen (`client/src/components/screens/OverviewScreen.tsx`)
- **Left Floating Info Panel** (`top: 24px; left: 24px; width: 280px;`):
  - Category header: `CHARACTERS 01`.
  - Character title: `Akari` with subtitle `Tsundere · Lively`.
  - Action buttons: "Edit character" with pencil icon, and delete trash icon.
  - Tab toggles: "Overview" and "Voice".
  - Voice engine selector: Toggle between "Fish Audio" and "GPT-SoVITS".
  - Primary CTA: "Start chat →" button that navigates directly to `/?screen=chat&character=akari`.
- **Right Badge**: "Drag to rotate" badge positioned at `top: 24px; right: 28px;`.
- **Bottom Character Selector Row** (`bottom: 24px; left: 24px;`):
  - Card selector showcasing active character avatar thumbnail (`/akari_avatar.jpg`) with active border.
  - "+ Add character" button.
- **Camera Offset Framing**: `<CameraRig isOverview={screen === "characters"} />` smoothly interpolates camera X position from `0` to `-0.26`, presenting the 3D avatar on the right side of the canvas to balance the left floating card.

#### 2. Chat Screen (`client/src/components/screens/ChatScreen.tsx`)
- Center-framed camera (`targetX = 0`).
- Top bar removed.
- Floating glassmorphic `<ChatInput />` at bottom (`bottom: 24px; left: calc(56px + 24px); right: 24px; max-width: 720px;`).
- Raised subtitle overlay (`bottom: 16%`) to prevent visual collision with the chat input bar.

#### 3. Stream Screen (`client/src/components/screens/StreamScreen.tsx`)
- Center-framed camera (`targetX = 0`).
- Floating status pill at bottom:
  - Pulsing status dot: Green when listening (`#8FAF91`), orange when speaking (`#E05A47`).
  - Text: "Stream Mode · Listening to microphone..." or "{Character} is speaking...".
  - Badge: "Server Mic Loop".
- Default subtitle overlay position (`bottom: 8%`).

#### 4. Gallery Screen (`client/src/components/screens/GalleryScreen.tsx`)
- Center-framed camera (`targetX = 0`).
- Right-aligned floating metadata card (`top: 24px; right: 24px; width: 280px;`):
  - Model format: VRM 1.0 humanoid avatar.
  - Render statistics: Polycount, blendshapes, bones.

---

## 5. Client-Server Protocol & Dynamic Mode Switching

### 5.1 Protocol Contracts

#### Client → Server: `set_mode`
Sent by the client on WebSocket connection and whenever the active screen changes:
```json
{
  "type": "set_mode",
  "chat_input_enabled": true,
  "mode": "chat",
  "screen": "chat"
}
```

#### Server → Client: `config`
Dispatched by the server upon handshake and broadcasted whenever the active mode changes:
```json
{
  "type": "config",
  "chat_input_enabled": true
}
```

### 5.2 Server Mode Management

| Feature | Chat Mode (`chat_input_enabled = True`) | Stream Mode (`chat_input_enabled = False`) |
| :--- | :--- | :--- |
| **Active Screen** | `chat` (and idle on `characters`, `galary`) | `stream` (OpenSpace) |
| **Server Voice Loop** | **Stopped** (`stop_voice_loop()`) | **Running** (`start_voice_loop()`) |
| **Server Mic Capture** | Inactive | Active via `listen_and_capture(stop_event)` |
| **Speech Generation** | Triggered by incoming `chat_message` | Triggered by server ASR silence threshold |
| **Client Input Bar** | Visible & interactive | Hidden (clean status pill displayed) |
| **Interrupt / Stop** | Supported via WebSocket `interrupt` | Supported via WebSocket `interrupt` |

### 5.4 Single Whisper Model Concurrency & Lifecycle
To prevent dual model allocations from exhausting host RAM or CPU cores:
1. **Chat Mode (`ENABLE_CHAT_INPUT = True`)**:
   - The `medium` ASR model (`voice_to_text.py`) is completely unloaded via `unload_asr_model()`.
   - Streaming Whisper (`stream_whisper.py`) lazily loads the lightweight `small.en` model only when browser voice chunks are received.
2. **Stream Mode (`ENABLE_CHAT_INPUT = False`)**:
   - Streaming Whisper (`small.en`) is unloaded via `unload_stream_model()`.
   - The full `medium` ASR model is loaded via `get_asr_model()` to process microphone recordings.
3. **Mutual Exclusion**: At no point in runtime are both `small.en` and `medium` models instantiated in memory simultaneously.
4. **All Clients Disconnected**: Both models are unloaded and garbage collected to return CPU/RAM to baseline.

### 5.5 Collapsible Sidebar & Floating `IconScanEye` Trigger
- **Hamburger Action**: Clicking `IconMenu2` at the top of the sidebar sets `isSidebarOpen = false`, sliding the sidebar offscreen (`transform: translateX(-100%)`) and allowing the 3D canvas viewport to occupy the full 100vw width (`left: 0`).
- **Floating Eye Trigger**: When collapsed, a floating button renders at `bottom: 24px; left: 20px;` containing `IconScanEye` with a translucent glassmorphic background matching the chatbox (`--bg-input-glass`, backdrop blur, thin border).
- **Reopen Action**: Clicking the floating eye button sets `isSidebarOpen = true`, smoothly sliding the sidebar back in and hiding the floating button.

---

## 6. Verification & Validation Checklist

- [x] Persistent 56px sidebar renders correctly across all 4 screens.
- [x] Top header bar (`PROJECT AKARI.`) completely removed from all screen views.
- [x] Chatbox in dark theme uses dark translucent glassmorphism with readable light text (`--color-input-text`) and clean button styling.
- [x] Clicking hamburger menu collapses the sidebar and renders floating `IconScanEye` in bottom-left.
- [x] Clicking floating `IconScanEye` re-opens sidebar and hides the floating button.
- [x] Exactly ONE Whisper model runs at a time (`small.en` on Chat, `medium` on Stream).
- [x] Dark mode tokens applied across sidebar, cards, and Three.js canvas background (`#1A1C1C`).
- [x] Light mode tokens applied across sidebar, cards, and Three.js canvas background (`#F7F7F5`).
- [x] Theme toggle updates both HTML DOM and WebGL canvas simultaneously without desynchronization.
- [x] Overview screen renders left info panel, "Drag to rotate" badge, and bottom avatar selector row.
- [x] "Start chat →" button navigates directly to `/?screen=chat&character=akari`.
- [x] Navigating to `stream` sends `{ type: "set_mode", chat_input_enabled: false }` and starts server voice loop.
- [x] Navigating to `chat` sends `{ type: "set_mode", chat_input_enabled: true }` and halts server voice loop.
- [x] Subtitles and lip-sync remain persistent across screen switches.
- [x] Production build passes with 0 TypeScript/lint errors (`bun run build`).
