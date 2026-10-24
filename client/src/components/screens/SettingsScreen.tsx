import React, { useState, useEffect } from "react";
import {
  IconSettings,
  IconCpu,
  IconKey,
  IconTools,
  IconCopy,
  IconCheck,
  IconLink,
} from "@tabler/icons-react";
import { avatarSocket } from "../../networking/AvatarSocket";
import { avatarEvents } from "../../networking/EventBus";
import type { ToolSummary } from "../../networking/types";

interface SettingsScreenProps {
  currentProvider: string;
  currentModel: string;
  toolsEnabled: boolean;
  currentCharacter: string;
  onUpdateProvider: (provider: string, model: string) => void;
  onToggleTools: (enabled: boolean) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  currentProvider,
  currentModel,
  toolsEnabled,
  currentCharacter,
  onUpdateProvider,
  onToggleTools,
}) => {
  const [provider, setProvider] = useState(currentProvider);
  const [model, setModel] = useState(currentModel);
  const [mistralKey, setMistralKey] = useState(() => localStorage.getItem("koko_mistral_api_key") || "");
  const [llamacppUrl, setLlamacppUrl] = useState(() => localStorage.getItem("koko_llamacpp_url") || "http://127.0.0.1:8080/v1");
  const [toolsList, setToolsList] = useState<ToolSummary[]>([]);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    const unsub = avatarEvents.on("config", (configData) => {
      if (configData?.available_tools) {
        setToolsList(configData.available_tools);
      }
    });

    const cfg = avatarSocket.getConfig();
    if (cfg?.available_tools) {
      setToolsList(cfg.available_tools);
    }

    return () => unsub();
  }, []);

  const handleProviderSelect = (newProvider: string) => {
    setProvider(newProvider);
    const defaultModel = newProvider === "mistral" ? "ministral-8b-latest" : "gemma-4-it";
    setModel(defaultModel);
    onUpdateProvider(newProvider, defaultModel);
  };

  const handleModelSelect = (newModel: string) => {
    setModel(newModel);
    onUpdateProvider(provider, newModel);
  };

  const handleSaveMistralKey = (key: string) => {
    setMistralKey(key);
    localStorage.setItem("koko_mistral_api_key", key);
    avatarSocket.setApiKey("mistral", key);
  };

  const handleSaveLlamacppUrl = (url: string) => {
    setLlamacppUrl(url);
    localStorage.setItem("koko_llamacpp_url", url);
    avatarSocket.setApiKey("llama_cpp", undefined, url);
  };

  const copyShareableUrl = () => {
    const url = `${window.location.origin}/?screen=chat&character=${currentCharacter}&model=${model}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    });
  };

  return (
    <div className="screen-container settings-screen-view animate-fade-in">
      <div className="settings-content glass-panel">
        <header className="settings-header">
          <div className="header-icon-wrap">
            <IconSettings size={26} />
          </div>
          <div>
            <h1 className="settings-title">Inference & Capabilities</h1>
            <p className="settings-desc">
              Configure foundation models (Mistral AI & llama.cpp Gemma 4) and agentic tool discovery.
            </p>
          </div>
        </header>

        {/* Section 1: Provider Selection */}
        <div className="settings-section">
          <h2 className="section-title">
            <IconCpu size={18} />
            <span>Inference Provider</span>
          </h2>
          <div className="provider-segmented-switch">
            <button
              type="button"
              className={`provider-switch-btn ${provider === "mistral" ? "active" : ""}`}
              onClick={() => handleProviderSelect("mistral")}
            >
              <span className="btn-label">Mistral AI</span>
              <span className="btn-sub">API Endpoint (128k Context)</span>
            </button>
            <button
              type="button"
              className={`provider-switch-btn ${provider === "llama_cpp" ? "active" : ""}`}
              onClick={() => handleProviderSelect("llama_cpp")}
            >
              <span className="btn-label">llama.cpp (Gemma 4)</span>
              <span className="btn-sub">Local / Remote OpenAI-compatible</span>
            </button>
          </div>
        </div>

        {/* Section 2: Model Picker */}
        <div className="settings-section">
          <h2 className="section-title">Active Foundation Model</h2>
          <div className="models-grid">
            {provider === "mistral" ? (
              <>
                <div
                  className={`model-card ${model === "ministral-8b-latest" ? "selected" : ""}`}
                  onClick={() => handleModelSelect("ministral-8b-latest")}
                >
                  <div className="model-name">Ministral 8B Latest</div>
                  <div className="model-badge">Default • Fast Chat • 128k • Function Calling</div>
                </div>
                <div
                  className={`model-card ${model === "pixtral-12b-2409" ? "selected" : ""}`}
                  onClick={() => handleModelSelect("pixtral-12b-2409")}
                >
                  <div className="model-name">Pixtral 12B</div>
                  <div className="model-badge">Native Vision • 128k Multimodal</div>
                </div>
                <div
                  className={`model-card ${model === "mistral-small-latest" ? "selected" : ""}`}
                  onClick={() => handleModelSelect("mistral-small-latest")}
                >
                  <div className="model-name">Mistral Small Latest</div>
                  <div className="model-badge">Reasoning • 32k • Function Calling</div>
                </div>
              </>
            ) : (
              <>
                <div
                  className={`model-card ${model === "gemma-4-it" ? "selected" : ""}`}
                  onClick={() => handleModelSelect("gemma-4-it")}
                >
                  <div className="model-name">Google Gemma 4 (Native Tools)</div>
                  <div className="model-badge">Native Function Calling • 256k Context</div>
                </div>
                <div
                  className={`model-card ${model === "gemma-4-26b-a4b-it" ? "selected" : ""}`}
                  onClick={() => handleModelSelect("gemma-4-26b-a4b-it")}
                >
                  <div className="model-name">Google Gemma 4 MoE</div>
                  <div className="model-badge">High Performance • 128k Context</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Section 3: Credentials & Endpoints */}
        <div className="settings-section">
          <h2 className="section-title">
            <IconKey size={18} />
            <span>Connection & Credentials</span>
          </h2>
          {provider === "mistral" ? (
            <div className="config-field">
              <label className="field-label">Mistral API Key</label>
              <input
                type="password"
                className="field-input"
                placeholder="Enter Mistral API Key..."
                value={mistralKey}
                onChange={(e) => handleSaveMistralKey(e.target.value)}
              />
              <span className="field-tip">Stored securely in local storage and synced to session.</span>
            </div>
          ) : (
            <div className="config-field">
              <label className="field-label">llama.cpp OpenAI-Compatible Server URL</label>
              <input
                type="text"
                className="field-input"
                placeholder="http://127.0.0.1:8080/v1"
                value={llamacppUrl}
                onChange={(e) => handleSaveLlamacppUrl(e.target.value)}
              />
              <span className="field-tip">Endpoint for running Gemma 4 with native function calling.</span>
            </div>
          )}
        </div>

        {/* Section 4: Tool Calling & Discovery */}
        <div className="settings-section">
          <div className="section-header-split">
            <h2 className="section-title">
              <IconTools size={18} />
              <span>Agentic Tools & Dynamic Discovery (20-Round Limit)</span>
            </h2>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={toolsEnabled}
                onChange={(e) => onToggleTools(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
          <p className="section-subtext">
            Koko AI verifies her active tools catalog via <code>get_available_tools</code> before declining any user request.
          </p>

          <div className="tools-catalog-grid">
            {toolsList.map((t) => (
              <div key={t.name} className="tool-card glass-panel">
                <div className="tool-card-header">
                  <span className="tool-name">{t.name}</span>
                  {t.aliases && t.aliases.length > 0 && (
                    <span className="tool-alias-badge">alias: {t.aliases[0]}</span>
                  )}
                </div>
                <p className="tool-desc">{t.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 5: Canonical Shareable URL */}
        <div className="settings-section">
          <h2 className="section-title">
            <IconLink size={18} />
            <span>Shareable Clean Link</span>
          </h2>
          <div className="shareable-link-row">
            <input
              type="text"
              readOnly
              className="field-input link-input"
              value={`${window.location.origin}/?screen=chat&character=${currentCharacter}&model=${model}`}
            />
            <button
              type="button"
              className="copy-link-btn"
              onClick={copyShareableUrl}
              title="Copy link"
            >
              {copiedUrl ? <IconCheck size={18} /> : <IconCopy size={18} />}
              <span>{copiedUrl ? "Copied!" : "Copy"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
