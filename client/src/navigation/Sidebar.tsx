import React, { useState, useEffect } from "react";
import {
  IconSun,
  IconMoon,
  IconUserSquareRounded,
  IconMessageCircle,
  IconCamera,
  IconSettings,
  IconBadgeCc,
  IconMenu,
} from "@tabler/icons-react";
import type { ScreenType } from "./types";
import { useTheme } from "./ThemeContext";
import { avatarSocket, type ConnectionStatus } from "../networking";
import "./Sidebar.css";

/** Props for the primary vertical glassmorphic application sidebar. */
interface SidebarProps {
  currentScreen: ScreenType;
  currentCharacter: string;
  onNavigate: (screen: ScreenType) => void;
  isOpen?: boolean;
  onToggleCollapse?: () => void;
  showSubtitles?: boolean;
  onToggleSubtitles?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentScreen,
  onNavigate,
  isOpen = true,
  onToggleCollapse,
  showSubtitles = true,
  onToggleSubtitles,
}) => {
  const { theme, setTheme } = useTheme();
  const [serverStatus, setServerStatus] = useState<ConnectionStatus>(
    avatarSocket.getConnectionStatus()
  );

  useEffect(() => {
    const unsubscribe = avatarSocket.onStatusChange((status) => {
      setServerStatus(status);
    });
    return unsubscribe;
  }, []);

  return (
    <aside className={`app-sidebar ${!isOpen ? "collapsed" : ""}`} aria-label="Application Sidebar">
      <div className="sidebar-top">
        <button
          type="button"
          className="sidebar-menu-btn"
          aria-label="Hide Sidebar"
          title="Hide Sidebar"
          onClick={onToggleCollapse}
        >
          <IconMenu size={19} stroke={1.8} />
        </button>

        <nav className="sidebar-nav-list" aria-label="Main Navigation">
          {/* 1. Characters / Overview */}
          <button
            type="button"
            className={`sidebar-nav-item ${currentScreen === "characters" ? "active" : ""}`}
            onClick={() => onNavigate("characters")}
            title="Characters / Overview"
            aria-label="Characters / Overview"
          >
            <IconUserSquareRounded size={19} stroke={1.7} />
          </button>

          {/* 2. Chat */}
          <button
            type="button"
            className={`sidebar-nav-item ${currentScreen === "chat" ? "active" : ""}`}
            onClick={() => onNavigate("chat")}
            title="Chat"
            aria-label="Chat"
          >
            <IconMessageCircle size={19} stroke={1.7} />
          </button>

          {/* 3. Gallery */}
          <button
            type="button"
            className={`sidebar-nav-item ${currentScreen === "gallery" ? "active" : ""}`}
            onClick={() => onNavigate("gallery")}
            title="Gallery"
            aria-label="Gallery"
          >
            <IconCamera size={19} stroke={1.7} />
          </button>
        </nav>
      </div>

      <div className="sidebar-bottom">
        {/* Server Connection Status Light */}
        <button
          type="button"
          className={`sidebar-status-btn ${serverStatus}`}
          title={
            serverStatus === "connected"
              ? "Server Connected (ws://127.0.0.1:8765)"
              : serverStatus === "connecting"
                ? "Connecting to server..."
                : "Server Disconnected (Offline) — Click to reconnect"
          }
          aria-label={`Server status: ${serverStatus}`}
          onClick={() => {
            if (serverStatus !== "connected") {
              avatarSocket.connect();
            }
          }}
        >
          <span className="sidebar-status-ping" />
          <span className="sidebar-status-dot" />
        </button>

        {/* Subtitles Toggle */}
        <button
          type="button"
          className={`sidebar-subtitle-btn ${showSubtitles ? "active" : "inactive"}`}
          onClick={onToggleSubtitles}
          title={showSubtitles ? "Subtitles: ON (Click to turn off)" : "Subtitles: OFF (Click to turn on)"}
          aria-label={showSubtitles ? "Disable subtitles" : "Enable subtitles"}
          aria-pressed={showSubtitles}
        >
          <IconBadgeCc size={20} stroke={1.8} />
        </button>

        <div className="sidebar-theme-group" role="group" aria-label="Theme mode switcher">
          {/* Sun icon for light theme */}
          <button
            type="button"
            className={`sidebar-theme-btn ${theme === "light" ? "active" : ""}`}
            onClick={() => setTheme("light")}
            title="Light mode"
            aria-label="Switch to light mode"
          >
            <IconSun size={16} stroke={1.8} />
          </button>

          {/* Moon icon for dark theme */}
          <button
            type="button"
            className={`sidebar-theme-btn ${theme === "dark" ? "active" : ""}`}
            onClick={() => setTheme("dark")}
            title="Dark mode"
            aria-label="Switch to dark mode"
          >
            <IconMoon size={16} stroke={1.8} />
          </button>
        </div>
        {/* Settings button */}
        <button
          type="button"
          className={`sidebar-nav-item ${currentScreen === "settings" ? "active" : ""}`}
          onClick={() => onNavigate("settings")}
          title="Settings"
          aria-label="Settings"
          style={{ marginTop: "12px" }}
        >
          <IconSettings size={19} stroke={1.7} />
        </button>
      </div>
    </aside>
  );
};
