import React from "react";
import { CHARACTERS, type CharacterDefinition } from "../character/types";
import { IconSparkles, IconMessageCircle, IconCheck } from "@tabler/icons-react";

interface OverviewScreenProps {
  activeCharacterId: string;
  onSelectCharacter: (id: string) => void;
  onStartChat: () => void;
}

export const OverviewScreen: React.FC<OverviewScreenProps> = ({
  activeCharacterId,
  onSelectCharacter,
  onStartChat,
}) => {
  const charactersList = Object.values(CHARACTERS);
  const selectedChar: CharacterDefinition =
    CHARACTERS[activeCharacterId] || CHARACTERS.koko;

  return (
    <div className="screen-container overview-screen-view animate-fade-in">
      <div className="overview-content glass-panel">
        <header className="overview-header">
          <div className="category-tag">
            <span className="tag-number">{selectedChar.tagNumber}</span>
            <span className="tag-name">{selectedChar.categoryTag}</span>
          </div>
          <h1 className="overview-title">Companion Deck</h1>
          <p className="overview-desc">
            Choose your interactive 3D anime companion. Powered by real-time WebGL, audio-reactive lip-sync, and agentic tools.
          </p>
        </header>

        {/* Character Selection Cards */}
        <div className="companion-deck-grid">
          {charactersList.map((char) => {
            const isSelected = char.id === activeCharacterId;
            return (
              <div
                key={char.id}
                className={`companion-card glass-panel ${isSelected ? "selected" : ""}`}
                onClick={() => onSelectCharacter(char.id)}
              >
                <div className="companion-avatar-wrapper">
                  <img src={char.avatarUrl} alt={char.name} className="companion-avatar-img" />
                  {isSelected && (
                    <div className="selected-indicator-badge">
                      <IconCheck size={16} />
                    </div>
                  )}
                </div>
                <div className="companion-card-info">
                  <div className="card-top-row">
                    <span className="card-tag">{char.categoryTag}</span>
                    <span className="card-number">{char.tagNumber}</span>
                  </div>
                  <h3 className="card-name">{char.displayName}</h3>
                  <p className="card-subtitle">{char.subtitle}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Companion Details & Start Chat Action */}
        <div className="companion-hero-detail glass-panel">
          <div className="hero-text-block">
            <div className="role-badge">
              <IconSparkles size={16} />
              <span>{selectedChar.role}</span>
            </div>
            <h2 className="hero-name">{selectedChar.name}</h2>
            <p className="hero-description">{selectedChar.description}</p>
          </div>

          <div className="hero-action-block">
            <button
              type="button"
              className="start-chat-btn"
              onClick={onStartChat}
            >
              <IconMessageCircle size={20} />
              <span>Start Chat with {selectedChar.displayName}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
