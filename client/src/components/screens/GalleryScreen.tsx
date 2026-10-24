import React, { useState } from "react";
import {
  IconPlayerPlay,
  IconPlayerStop,
  IconRotate,
  IconSparkles,
  IconMoodSmile,
  IconAdjustmentsHorizontal,
  IconInfoCircle,
  IconCheck,
  IconCamera,
} from "@tabler/icons-react";
import {
  useCharacterControls,
  ANIMATIONS,
  EMOTIONS,
  getCharacterConfig,
  type AnimationName,
  type EmotionName,
} from "../character";
import "./GalleryScreen.css";

interface GalleryScreenProps {
  character: string;
}

type GalleryTab = "animation" | "emotion" | "pose" | "info";

const ANIMATION_DESCRIPTIONS: Record<AnimationName, string> = {
  Idle: "Gentle standing sway and natural breathing",
  Blush: "Cute, shy blushing expression and posture",
  Clapping: "Delighted applause and cheering",
  Jump: "Energetic hop and happy bounce",
  LookAround: "Curious head turn and spatial scan",
  Relax: "Calm and peaceful resting posture",
  Sad: "Dejected, pouting slump",
  Sleepy: "Drowsy yawn and waking stretch",
  Surprised: "Startled jump with wide eyes",
  Thinking: "Hand-on-chin inquisitive thinking",
};

const EMOTION_ICONS: Record<EmotionName, string> = {
  Neutral: "😐",
  Happy: "😊",
  Sad: "🥺",
  Angry: "😤",
  Relaxed: "😌",
  Surprised: "😲",
};

export const GalleryScreen: React.FC<GalleryScreenProps> = ({ character }) => {
  const [activeTab, setActiveTab] = useState<GalleryTab>("animation");

  const {
    animation,
    emotion,
    pose,
    setAnimation,
    setEmotion,
    setArmX,
    setArmY,
    setArmZ,
    resetPose,
    resetAll,
  } = useCharacterControls();

  const displayName = character.toLowerCase() === "akari" ? "Koko" : (character.charAt(0).toUpperCase() + character.slice(1));
  const animationKeys = Object.keys(ANIMATIONS) as AnimationName[];
  const emotionKeys = Object.keys(EMOTIONS) as EmotionName[];

  return (
    <div className="gallery-screen-root" aria-label="Character Studio Gallery Screen">
      {/* ─── Orbit / Zoom Hint (Top Right) ─────────────────────────── */}
      <div className="gallery-rotate-hint" aria-hidden="true">
        <IconCamera size={14} stroke={1.8} />
        <span>Drag to orbit · Scroll to zoom</span>
      </div>

      {/* ─── Left Character Inspector Modal Panel ───────────────────── */}
      <aside className="gallery-info-panel" aria-label="Character Studio Controls">
        {/* Header Section */}
        <div className="gallery-header-section">
          <div className="gallery-category-tag">
            <span>STUDIO / GALLERY</span>
            <span>04</span>
          </div>
          <h1 className="gallery-character-name">{displayName} Studio</h1>
          <div className="gallery-character-subtitle">
            3D Inspector · Animations · Expressions · Poses
          </div>
        </div>

        {/* Quick Action Bar */}
        <div className="gallery-action-row">
          <button
            type="button"
            className="gallery-quick-btn"
            title="Reset avatar to default pose and neutral expression"
            onClick={resetAll}
          >
            <IconRotate size={15} stroke={1.8} />
            <span>Reset All</span>
          </button>
          {animation !== "None" && (
            <button
              type="button"
              className="gallery-stop-btn"
              title="Stop currently playing animation"
              onClick={() => setAnimation("None")}
            >
              <IconPlayerStop size={15} stroke={1.8} />
              <span>Stop Motion</span>
            </button>
          )}
        </div>

        {/* Navigation Tabs Row */}
        <div className="gallery-tabs-row" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "animation"}
            className={`gallery-tab ${activeTab === "animation" ? "active" : ""}`}
            onClick={() => setActiveTab("animation")}
          >
            <IconSparkles size={14} stroke={1.8} />
            <span>Motion</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "emotion"}
            className={`gallery-tab ${activeTab === "emotion" ? "active" : ""}`}
            onClick={() => setActiveTab("emotion")}
          >
            <IconMoodSmile size={14} stroke={1.8} />
            <span>Emotions</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "pose"}
            className={`gallery-tab ${activeTab === "pose" ? "active" : ""}`}
            onClick={() => setActiveTab("pose")}
          >
            <IconAdjustmentsHorizontal size={14} stroke={1.8} />
            <span>Pose</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "info"}
            className={`gallery-tab ${activeTab === "info" ? "active" : ""}`}
            onClick={() => setActiveTab("info")}
          >
            <IconInfoCircle size={14} stroke={1.8} />
            <span>Info</span>
          </button>
        </div>

        {/* ─── Tab Content: Motion / Animations ────────────────────── */}
        {activeTab === "animation" && (
          <div className="gallery-tab-pane">
            <div className="gallery-status-banner">
              <span className="gallery-status-label">Active Motion:</span>
              <span className="gallery-status-val">
                {animation === "None" ? "Relaxed Base Pose" : animation}
              </span>
            </div>

            <div className="gallery-items-grid">
              {/* None / Base Pose Card */}
              <button
                type="button"
                className={`gallery-item-card ${animation === "None" ? "active" : ""}`}
                onClick={() => setAnimation("None")}
              >
                <div className="gallery-item-main">
                  <div className="gallery-item-icon">
                    <IconPlayerStop size={16} stroke={1.8} />
                  </div>
                  <div className="gallery-item-text">
                    <div className="gallery-item-title">None (Stop)</div>
                    <div className="gallery-item-desc">Freezes motion and returns to arm pose</div>
                  </div>
                </div>
                {animation === "None" && (
                  <div className="gallery-item-check">
                    <IconCheck size={14} stroke={2.5} />
                  </div>
                )}
              </button>

              {/* Animation Cards */}
              {animationKeys.map((name) => {
                const isSelected = animation === name;
                return (
                  <button
                    key={name}
                    type="button"
                    className={`gallery-item-card ${isSelected ? "active" : ""}`}
                    onClick={() => setAnimation(name)}
                  >
                    <div className="gallery-item-main">
                      <div className="gallery-item-icon">
                        <IconPlayerPlay size={16} stroke={1.8} />
                      </div>
                      <div className="gallery-item-text">
                        <div className="gallery-item-title">{name}</div>
                        <div className="gallery-item-desc">
                          {ANIMATION_DESCRIPTIONS[name] || "Preset animation clip"}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="gallery-item-check">
                        <IconCheck size={14} stroke={2.5} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Tab Content: Emotions / Expressions ──────────────────── */}
        {activeTab === "emotion" && (
          <div className="gallery-tab-pane">
            <div className="gallery-status-banner">
              <span className="gallery-status-label">Facial Morph:</span>
              <span className="gallery-status-val">{emotion}</span>
            </div>

            <div className="gallery-emotions-grid">
              {emotionKeys.map((name) => {
                const isSelected = emotion === name;
                return (
                  <button
                    key={name}
                    type="button"
                    className={`gallery-emotion-card ${isSelected ? "active" : ""}`}
                    onClick={() => setEmotion(name)}
                  >
                    <span className="gallery-emotion-emoji">{EMOTION_ICONS[name] || "✨"}</span>
                    <span className="gallery-emotion-name">{name}</span>
                    {isSelected && (
                      <span className="gallery-emotion-pill">
                        <IconCheck size={12} stroke={2.8} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Tab Content: Pose (Arm Rotation Sliders) ─────────────── */}
        {activeTab === "pose" && (
          <div className="gallery-tab-pane">
            <div className="gallery-pose-header">
              <div className="gallery-pose-info">
                <span className="gallery-pose-title">Relaxed Arm Joint Angles</span>
                <span className="gallery-pose-hint">
                  {animation !== "None"
                    ? "Currently overridden by active animation clip."
                    : "Live rotation applied to avatar shoulder & arms."}
                </span>
              </div>
              <button
                type="button"
                className="gallery-pose-reset-btn"
                onClick={resetPose}
                title="Reset arm angles to defaults (5°, 8°, 72°)"
              >
                Reset
              </button>
            </div>

            <div className="gallery-sliders-group">
              {/* Arm X */}
              <div className="gallery-slider-row">
                <div className="gallery-slider-label-row">
                  <label htmlFor="pose-arm-x" className="gallery-slider-label">
                    Arm X Axis
                  </label>
                  <span className="gallery-slider-value">{pose.armX}°</span>
                </div>
                <input
                  id="pose-arm-x"
                  type="range"
                  min="-90"
                  max="90"
                  step="1"
                  value={pose.armX}
                  onChange={(e) => setArmX(Number(e.target.value))}
                  className="gallery-range-input"
                />
              </div>

              {/* Arm Y */}
              <div className="gallery-slider-row">
                <div className="gallery-slider-label-row">
                  <label htmlFor="pose-arm-y" className="gallery-slider-label">
                    Arm Y Axis
                  </label>
                  <span className="gallery-slider-value">{pose.armY}°</span>
                </div>
                <input
                  id="pose-arm-y"
                  type="range"
                  min="-90"
                  max="90"
                  step="1"
                  value={pose.armY}
                  onChange={(e) => setArmY(Number(e.target.value))}
                  className="gallery-range-input"
                />
              </div>

              {/* Arm Z */}
              <div className="gallery-slider-row">
                <div className="gallery-slider-label-row">
                  <label htmlFor="pose-arm-z" className="gallery-slider-label">
                    Arm Z Axis
                  </label>
                  <span className="gallery-slider-value">{pose.armZ}°</span>
                </div>
                <input
                  id="pose-arm-z"
                  type="range"
                  min="-90"
                  max="90"
                  step="1"
                  value={pose.armZ}
                  onChange={(e) => setArmZ(Number(e.target.value))}
                  className="gallery-range-input"
                />
              </div>
            </div>

            {/* Presets */}
            <div className="gallery-pose-presets">
              <span className="gallery-presets-label">Presets:</span>
              <button
                type="button"
                className="gallery-preset-pill"
                onClick={() => {
                  setArmX(5);
                  setArmY(8);
                  setArmZ(72);
                }}
              >
                Relaxed
              </button>
              <button
                type="button"
                className="gallery-preset-pill"
                onClick={() => {
                  setArmX(0);
                  setArmY(0);
                  setArmZ(20);
                }}
              >
                Arms Low
              </button>
              <button
                type="button"
                className="gallery-preset-pill"
                onClick={() => {
                  setArmX(15);
                  setArmY(25);
                  setArmZ(82);
                }}
              >
                Hands Near
              </button>
            </div>
          </div>
        )}

        {/* ─── Tab Content: Model Info ──────────────────────────────── */}
        {activeTab === "info" && (
          <div className="gallery-tab-pane">
            <div className="gallery-meta-list">
              <div className="gallery-meta-item">
                <span className="gallery-meta-label">Format</span>
                <span className="gallery-meta-val">VRM 1.0 (GLTF 2.0)</span>
              </div>
              <div className="gallery-meta-item">
                <span className="gallery-meta-label">Model Target</span>
                <span className="gallery-meta-val">{getCharacterConfig(character).name}</span>
              </div>
              <div className="gallery-meta-item">
                <span className="gallery-meta-label">Outfit</span>
                <span className="gallery-meta-val">Default Casual Uniform</span>
              </div>
              <div className="gallery-meta-item">
                <span className="gallery-meta-label">Morph Targets</span>
                <span className="gallery-meta-val">Visemes (aa, ih, ou, ee, oh)</span>
              </div>
              <div className="gallery-meta-item">
                <span className="gallery-meta-label">Autonomous</span>
                <span className="gallery-meta-val">Blink, Breathing, LookAt</span>
              </div>
              <div className="gallery-meta-item">
                <span className="gallery-meta-label">Physics</span>
                <span className="gallery-meta-val">SpringBone Hair & Cloth</span>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};
