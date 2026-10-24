import React from "react";
import ChatInput from "../ChatInput";
import "./ChatScreen.css";

interface ChatScreenProps {
  character: string;
  onBackToOverview: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ character }) => {
  return (
    <div className="chat-screen-root" aria-label="Interactive Chat Screen">
      {/* Persistent floating glassmorphic input bar */}
      <ChatInput character={character} />
    </div>
  );
};
