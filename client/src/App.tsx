import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Scene from "./components/scene";
import SubtitleOverlay from "./components/SubtitleOverlay";
import { audioPlayer } from "./audio/AudioPlayer";
import { useEffect, useState } from "react";
import { IconEye } from "@tabler/icons-react";
import { Sidebar } from "./navigation/Sidebar";
import { useNavigation } from "./navigation/useNavigation";
import { ThemeProvider } from "./navigation/ThemeContext";
import { OverviewScreen } from "./components/screens/OverviewScreen";
import { ChatScreen } from "./components/screens/ChatScreen";
import { GalleryScreen } from "./components/screens/GalleryScreen";
import { SettingsScreen } from "./components/screens/SettingsScreen";
import { avatarSocket } from "./networking/AvatarSocket";
import "./App.css";

function CameraRig({ isFramed }: { isFramed: boolean }) {
  useFrame((state, delta) => {
    const targetX = isFramed ? -0.26 : 0;
    state.camera.position.x = THREE.MathUtils.damp(state.camera.position.x, targetX, 5, delta);
  });
  return null;
}

const SUBTITLES_STORAGE_KEY = "koko_subtitles_enabled";

function AppContent() {
  const { screen, character, provider, model, tools, navigate, updateLlm, updateToolCalling } = useNavigation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const isFramed = screen === "characters" || screen === "gallery" || (screen as string) === "galary";
  const [showSubtitles, setShowSubtitles] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem(SUBTITLES_STORAGE_KEY) || localStorage.getItem("akari_subtitles_enabled");
    return saved !== null ? saved === "true" : true;
  });

  const handleToggleSubtitles = () => {
    setShowSubtitles((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SUBTITLES_STORAGE_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  // Synchronize dynamic conversation mode with backend whenever screen changes:
  useEffect(() => {
    avatarSocket.setMode(true, screen);
  }, [screen]);

  // Unlock Web Audio on first pointer interaction
  useEffect(() => {
    const unlock = () => {
      audioPlayer.resume();
      window.removeEventListener("pointerdown", unlock);
    };

    window.addEventListener("pointerdown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
    };
  }, []);

  return (
    <div className="app-shell">
      {/* ─── 1. Persistent Shared Sidebar ──────────────────────────────────── */}
      <Sidebar
        currentScreen={screen}
        currentCharacter={character}
        onNavigate={(targetScreen) => navigate(targetScreen, character)}
        isOpen={isSidebarOpen}
        onToggleCollapse={() => setIsSidebarOpen(false)}
        showSubtitles={showSubtitles}
        onToggleSubtitles={handleToggleSubtitles}
      />

      {/* ─── Floating Sidebar Reveal Button (Bottom Left) ────────────────── */}
      {!isSidebarOpen && (
        <button
          type="button"
          className="floating-sidebar-toggle-btn"
          onClick={() => setIsSidebarOpen(true)}
          title="Open sidebar"
          aria-label="Open sidebar"
        >
          <IconEye size={22} stroke={1.8} />
        </button>
      )}

      {/* ─── 2. Main Viewport & 3D Avatar Canvas ────────────────────────────── */}
      <main className={`main-viewport ${!isSidebarOpen ? "sidebar-collapsed" : ""}`}>
        {screen !== "settings" && (
          <Canvas
            shadows
            dpr={[1, 2]}
            camera={{
              position: [isFramed ? -0.26 : 0, 1.35, 1.25],
              fov: 26,
            }}
            gl={{
              antialias: true,
              alpha: false,
              powerPreference: "high-performance",
            }}
            onCreated={({ gl }) => {
              gl.outputColorSpace = THREE.SRGBColorSpace;
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 0.9;
            }}
          >
            <CameraRig isFramed={isFramed} />
            <Scene character={character} />

            <OrbitControls
              makeDefault
              target={[isFramed ? -0.26 : 0, 1.32, 0.2]}
              enableDamping
              dampingFactor={0.08}
              rotateSpeed={0.6}
              minDistance={1.2}
              maxDistance={3}
            />
          </Canvas>
        )}

        {/* ─── 3. Screen View Layer ────────────────────────────────────────── */}
        {screen === "characters" && (
          <OverviewScreen
            character={character}
            onSelectCharacter={(newChar) => navigate("characters", newChar)}
            onStartChat={() => navigate("chat", character)}
            onOpenSettings={() => navigate("settings", character)}
          />
        )}

        {screen === "chat" && (
          <ChatScreen
            character={character}
            onBackToOverview={() => navigate("characters", character)}
          />
        )}

        {(screen === "gallery" || (screen as string) === "galary") && (
          <GalleryScreen
            character={character}
          />
        )}

        {screen === "settings" && (
          <SettingsScreen
            currentCharacter={character}
            currentProvider={provider}
            currentModel={model}
            currentToolsEnabled={tools}
            onUpdateLlm={updateLlm}
            onUpdateTools={updateToolCalling}
          />
        )}

        {/* Global subtitle overlay with dynamic height based on active screen */}
        {screen !== "settings" && (
          <SubtitleOverlay raised={screen === "chat"} enabled={showSubtitles} />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}