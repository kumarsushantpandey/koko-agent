import React from "react";
import {
  IconMessage2,
  IconUsers,
  IconSettings,
  IconSparkles,
  IconTrash,
} from "@tabler/icons-react";
import type { ScreenType } from "./useNavigation";
import type { ThemeType } from "./useTheme";
import { avatarSocket } from "../networking/AvatarSocket";

interface SidebarProps {
  currentScreen: ScreenType;
  currentTheme: ThemeType;
  onNavigate: (screen: ScreenType) => void;
  onCycleTheme: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentScreen,
  currentTheme,
  onNavigate,
  onCycleTheme,
}) => {
  return (
    <aside className="floating-sidebar glass-panel">
      <div className="sidebar-brand" onClick={() => onNavigate("chat")} title="Koko AI">
        <div className="brand-dot animate-pulse" />
      </div>

      <nav className="sidebar-nav">
        <button
          type="button"
          className={`sidebar-item ${currentScreen === "chat" ? "active" : ""}`}
          onClick={() => onNavigate("chat")}
          title="Interactive 3D Chat"
        >
          <IconMessage2 size={22} />
          <span className="tooltip">Chat</span>
        </button>

        <button
          type="button"
          className={`sidebar-item ${currentScreen === "characters" ? "active" : ""}`}
          onClick={() => onNavigate("characters")}
          title="Companions Deck"
        >
          <IconUsers size={22} />
          <span className="tooltip">Characters</span>
        </button>

        <button
          type="button"
          className={`sidebar-item ${currentScreen === "settings" ? "active" : ""}`}
          onClick={() => onNavigate("settings")}
          title="Inference & Tools Settings"
        >
          <IconSettings size={22} />
          <span className="tooltip">Settings</span>
        </button>
      </nav>

      <div className="sidebar-bottom">
        <button
          type="button"
          className="sidebar-item"
          onClick={() => {
            if (confirm("Clear active chat conversation history?")) {
              avatarSocket.clearHistory();
            }
          }}
          title="Clear Conversation History"
        >
          <IconTrash size={20} />
          <span className="tooltip">Clear Memory</span>
        </button>

        <button
          type="button"
          className="sidebar-item theme-btn"
          onClick={onCycleTheme}
          title={`Theme: ${currentTheme}`}
        >
          <IconSparkles size={20} />
          <span className="tooltip">{currentTheme.toUpperCase()}</span>
        </button>
      </div>
    </aside>
  );
};
