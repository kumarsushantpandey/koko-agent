import React, { useState } from "react";
import {
  IconPencil,
  IconArrowRight,
  IconPlus,
  IconCamera,
} from "@tabler/icons-react";
import { CHARACTER_LIST, getCharacterConfig } from "../character";
import "./OverviewScreen.css";

interface OverviewScreenProps {
  character: string;
  onStartChat: () => void;
  onOpenSettings?: () => void;
  onSelectCharacter?: (characterId: string) => void;
}

export const OverviewScreen: React.FC<OverviewScreenProps> = ({
  character,
  onStartChat,
  onOpenSettings,
  onSelectCharacter,
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "voice">("overview");
  const [voiceEngine, setVoiceEngine] = useState<"fish" | "sovits">("fish");

  const config = getCharacterConfig(character);

  return (
    <div className="overview-screen-root" aria-label="Character Overview Screen">
      {/* ─── Left Character Information Panel ──────────────────────────────── */}
      <aside className="overview-info-panel" aria-label="Character Details">
        <div className="panel-header-section">
          <div className="panel-category-tag">
            <span>{config.categoryTag}</span>
            <span>{config.tagNumber}</span>
          </div>
          <h1 className="panel-character-name">{config.name}</h1>
          <div className="panel-character-subtitle">{config.subtitle}</div>
        </div>

        <div className="panel-action-row">
          <button
            type="button"
            className="panel-edit-btn"
            title="Edit character profile"
            onClick={() => { }}
          >
            <IconPencil size={15} stroke={1.8} />
            <span>Edit character</span>
          </button>
          <button
            type="button"
            className="panel-icon-btn"
            title="Take snapshot"
            onClick={() => { }}
          >
            <IconCamera size={16} stroke={1.8} />
          </button>
        </div>

        {/* Overview / Voice tabs */}
        <div className="panel-tabs-row" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "overview"}
            className={`panel-tab ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "voice"}
            className={`panel-tab ${activeTab === "voice" ? "active" : ""}`}
            onClick={() => setActiveTab("voice")}
          >
            Voice
          </button>
        </div>

        {/* Overview tab description */}
        {activeTab === "overview" && (
          <div className="panel-overview-desc-box">
            <p className="panel-character-desc">{config.description}</p>
            <div className="panel-character-pills">
              <span className="panel-pill">{config.role}</span>
              <span className="panel-pill">Active VRM</span>
            </div>
          </div>
        )}

        {/* Personality & model link -> takes user to Settings page */}
        <div
          className="panel-nav-row"
          onClick={onOpenSettings}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onOpenSettings?.()}
          title="Open Settings to configure Personality & AI Model"
        >
          <span>Personality & model</span>
          <IconArrowRight size={14} stroke={2} />
        </div>

        {/* Voice engine configuration (Voice Tab) */}
        {activeTab === "voice" && (
          <div className="panel-voice-section">
            <div className="panel-voice-header">
              <span className="panel-voice-title">Voice</span>
              <span className="panel-voice-config">Configure</span>
            </div>

            <div className="panel-voice-toggles">
              <button
                type="button"
                className={`panel-voice-toggle-btn ${voiceEngine === "fish" ? "active" : ""}`}
                onClick={() => setVoiceEngine("fish")}
              >
                Fish Audio
              </button>
              <button
                type="button"
                className={`panel-voice-toggle-btn ${voiceEngine === "sovits" ? "active" : ""}`}
                onClick={() => setVoiceEngine("sovits")}
              >
                GPT-SoVITS
              </button>
            </div>

            <p className="panel-voice-caption">
              {voiceEngine === "fish"
                ? "Fish Audio: High-speed real-time synthetic voice stream."
                : "GPT-SoVITS: Voice reference model synthesized locally."}
            </p>
          </div>
        )}

        {/* Primary CTA */}
        <button
          type="button"
          className="panel-start-chat-btn"
          onClick={onStartChat}
        >
          <span>Start chat with {config.displayName}</span>
          <IconArrowRight size={16} stroke={2.5} />
        </button>
      </aside>

      {/* ─── Bottom Character Selector Row ─────────────────────────────────── */}
      <div className="overview-bottom-selector" aria-label="Character Selector">
        <div className="selector-cards-row">
          {CHARACTER_LIST.map((charItem) => {
            const isSelected = character.toLowerCase() === charItem.id.toLowerCase();
            return (
              <div
                key={charItem.id}
                className="selector-card-wrapper"
                role="button"
                tabIndex={0}
                onClick={() => onSelectCharacter?.(charItem.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelectCharacter?.(charItem.id)}
                title={`Select ${charItem.name}`}
                aria-pressed={isSelected}
              >
                <div className={`selector-card ${isSelected ? "selected" : ""}`}>
                  <img
                    src={charItem.avatarUrl}
                    alt={charItem.name}
                    className="selector-card-img"
                  />
                </div>
                <span className="selector-card-name">{charItem.displayName}</span>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="selector-add-btn"
          title="Add a new character"
        >
          <IconPlus size={14} stroke={2} />
          <span>Add character</span>
        </button>
      </div>
    </div>
  );
};
