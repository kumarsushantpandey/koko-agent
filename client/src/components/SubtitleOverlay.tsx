import React, { useEffect, useState } from "react";
import { avatarEvents } from "../networking/EventBus";

export function cleanSubtitleText(raw: string): string {
  if (!raw) return "";
  // Strip bracketed emotion tags: [happy], [angry], etc.
  let clean = raw.replace(/\[[a-zA-Z_\-]+\]/g, "");
  // Strip markdown action/emphasis asterisks: *word* -> word, lone * -> ""
  clean = clean.replace(/\*+/g, "");
  return clean.trim();
}

interface SubtitleOverlayProps {
  speakerName?: string;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({ speakerName = "Koko" }) => {
  const [subtitle, setSubtitle] = useState<string>("");
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);

  useEffect(() => {
    const unsubSegment = avatarEvents.on("speech_segment", (data) => {
      if (data?.text) {
        setSubtitle(cleanSubtitleText(data.text));
        setIsSpeaking(true);
      }
    });

    const unsubStart = avatarEvents.on("speech_start", () => {
      setIsSpeaking(true);
    });

    const unsubEnd = avatarEvents.on("speech_end", () => {
      setIsSpeaking(false);
      // Fade out subtitle after 4 seconds
      setTimeout(() => {
        setSubtitle((prev) => (isSpeaking ? prev : ""));
      }, 4000);
    });

    const unsubThinkingStart = avatarEvents.on("thinking_start", () => {
      setIsThinking(true);
      setActiveTool(null);
    });

    const unsubThinkingEnd = avatarEvents.on("thinking_end", () => {
      setIsThinking(false);
    });

    const unsubToolStart = avatarEvents.on("tool_start", (data) => {
      setActiveTool(data?.tool_name || "Executing tool...");
    });

    const unsubToolEnd = avatarEvents.on("tool_end", () => {
      setActiveTool(null);
    });

    return () => {
      unsubSegment();
      unsubStart();
      unsubEnd();
      unsubThinkingStart();
      unsubThinkingEnd();
      unsubToolStart();
      unsubToolEnd();
    };
  }, [isSpeaking]);

  if (!subtitle && !isThinking && !activeTool) {
    return null;
  }

  return (
    <div className="subtitle-overlay-container">
      <div className="subtitle-card glass-panel">
        <div className="subtitle-header">
          <span className="speaker-badge">{speakerName}</span>
          {isThinking && <span className="thinking-pill animate-pulse">Thinking...</span>}
          {activeTool && <span className="tool-pill">Tool: {activeTool}</span>}
        </div>
        {subtitle && <p className="subtitle-text">{subtitle}</p>}
      </div>
    </div>
  );
};
