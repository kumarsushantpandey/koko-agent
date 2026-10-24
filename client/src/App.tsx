import React, { useEffect, useState } from "react";
import { Scene } from "./components/scene";
import { Sidebar } from "./navigation/Sidebar";
import { useNavigation } from "./navigation/useNavigation";
import { useTheme } from "./navigation/useTheme";
import { ChatScreen } from "./components/screens/ChatScreen";
import { OverviewScreen } from "./components/screens/OverviewScreen";
import { SettingsScreen } from "./components/screens/SettingsScreen";
import { avatarSocket } from "./networking/AvatarSocket";
import { avatarEvents } from "./networking/EventBus";

export const App: React.FC = () => {
  const { screen, character, provider, model, tools, navigate } = useNavigation();
  const { theme, cycleTheme } = useTheme();
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "connecting" | "disconnected">("connecting");

  useEffect(() => {
    avatarSocket.connect();

    const unsubStatus = avatarEvents.on("status", (status) => {
      setConnectionStatus(status);
    });

    // Hydrate runtime credentials if present
    const savedMistralKey = localStorage.getItem("koko_mistral_api_key");
    const savedLlamacppUrl = localStorage.getItem("koko_llamacpp_url");
    if (savedMistralKey) {
      avatarSocket.setApiKey("mistral", savedMistralKey);
    }
    if (savedLlamacppUrl) {
      avatarSocket.setApiKey("llama_cpp", undefined, savedLlamacppUrl);
    }

    return () => {
      unsubStatus();
    };
  }, []);

  return (
    <div className="app-layout">
      {/* 3D VRM Three.js Viewport */}
      <Scene characterId={character} />

      {/* Floating Sidebar Navigation */}
      <Sidebar
        currentScreen={screen}
        currentTheme={theme}
        onNavigate={(targetScreen) => navigate(targetScreen, character, provider, model, tools)}
        onCycleTheme={cycleTheme}
      />

      {/* Connection Indicator Pill */}
      <div className={`connection-status-pill status-${connectionStatus}`} title={`Backend: ${connectionStatus}`}>
        <span className="status-dot" />
        <span className="status-label">
          {connectionStatus === "connected" ? "Koko Online" : connectionStatus === "connecting" ? "Connecting..." : "Offline"}
        </span>
      </div>

      {/* Foreground Screen Layer */}
      <main className="app-screen-layer">
        {screen === "chat" && (
          <ChatScreen
            characterId={character}
            provider={provider}
            model={model}
            toolsEnabled={tools}
          />
        )}

        {screen === "characters" && (
          <OverviewScreen
            activeCharacterId={character}
            onSelectCharacter={(newCharId) =>
              navigate("characters", newCharId, provider, model, tools)
            }
            onStartChat={() => navigate("chat", character, provider, model, tools)}
          />
        )}

        {screen === "settings" && (
          <SettingsScreen
            currentProvider={provider}
            currentModel={model}
            toolsEnabled={tools}
            currentCharacter={character}
            onUpdateProvider={(newProv, newMod) =>
              navigate("settings", character, newProv, newMod, tools)
            }
            onToggleTools={(newTools) =>
              navigate("settings", character, provider, model, newTools)
            }
          />
        )}
      </main>
    </div>
  );
};

export default App;
