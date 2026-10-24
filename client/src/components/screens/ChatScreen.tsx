import React from "react";
import { SubtitleOverlay } from "../SubtitleOverlay";
import { ChatInput } from "../ChatInput";
import { CHARACTERS } from "../character/types";

interface ChatScreenProps {
  characterId: string;
  provider: string;
  model: string;
  toolsEnabled: boolean;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  characterId,
  provider,
  model,
  toolsEnabled,
}) => {
  const char = CHARACTERS[characterId] || CHARACTERS.koko;

  return (
    <div className="screen-container chat-screen-view">
      {/* Subtitles Overlay pinned near upper-middle viewport */}
      <SubtitleOverlay speakerName={char.displayName} />

      {/* Floating Bottom Chat Input */}
      <ChatInput
        placeholder={char.placeholderText}
        provider={provider}
        model={model}
        toolsEnabled={toolsEnabled}
      />
    </div>
  );
};
