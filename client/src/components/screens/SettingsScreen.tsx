import React, { useEffect, useState } from "react";
import {
  IconCpu,
  IconSparkles,
  IconCheck,
  IconLink,
  IconCopy,
  IconChecklist,
  IconTools,
  IconClock,
  IconCalendar,
  IconDeviceDesktopAnalytics,
  IconAlertCircle,
  IconCalculator,
  IconWorld,
  IconKey,
  IconEye,
  IconEyeOff,
  IconSearch,
  IconTerminal2,
  IconFileCode,
  IconServer,
  IconRefresh,
} from "@tabler/icons-react";
import { avatarEvents, avatarSocket } from "../../networking";
import "./SettingsScreen.css";

interface SettingsScreenProps {
  currentCharacter?: string;
  currentProvider: string;
  currentModel: string;
  currentToolsEnabled?: boolean;
  onUpdateLlm: (provider: string, model?: string) => void;
  onUpdateTools?: (enabled: boolean) => void;
}

export interface ModelDetail {
  id: string;
  name: string;
  badge?: string;
  context: string;
  toolCallingSupported: boolean;
  visionSupported?: boolean;
}

export interface ProviderDetail {
  id: "mistral" | "llama_cpp";
  name: string;
  badge: string;
  toolCallingSupported: boolean;
  visionSupported?: boolean;
  models: ModelDetail[];
}

const PROVIDERS: ProviderDetail[] = [
  {
    id: "mistral",
    name: "Mistral AI",
    badge: "Official API",
    toolCallingSupported: true,
    visionSupported: true,
    models: [
      {
        id: "ministral-8b-latest",
        name: "Ministral 8B",
        badge: "Recommended",
        context: "128k context",
        toolCallingSupported: true,
        visionSupported: false,
      },
      {
        id: "pixtral-12b-2409",
        name: "Pixtral 12B",
        badge: "Vision",
        context: "128k context",
        toolCallingSupported: false,
        visionSupported: true,
      },
      {
        id: "mistral-small-latest",
        name: "Mistral Small",
        badge: "Reasoning",
        context: "32k context",
        toolCallingSupported: true,
        visionSupported: false,
      },
    ],
  },
  {
    id: "llama_cpp",
    name: "llama.cpp (Gemma 4)",
    badge: "Local GGUF",
    toolCallingSupported: true,
    visionSupported: false,
    models: [
      {
        id: "ggml-org/gemma-4-E2B-it-GGUF:Q4_0",
        name: "Gemma 4 E2B IT (Q4_0, 2.2 GB)",
        badge: "Native Tools",
        context: "8k context",
        toolCallingSupported: true,
        visionSupported: false,
      },
    ],
  },
];

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  currentCharacter = "koko",
  currentProvider,
  currentModel,
  currentToolsEnabled = true,
  onUpdateLlm,
  onUpdateTools,
}) => {
  const [provider, setProvider] = useState<"mistral" | "llama_cpp">(() => {
    return (currentProvider === "llama_cpp" || currentProvider === "llamacpp") ? "llama_cpp" : "mistral";
  });
  const [model, setModel] = useState<string>(currentModel || "ministral-8b-latest");
  const [toolsEnabled, setToolsEnabled] = useState<boolean>(currentToolsEnabled);
  const [isCopied, setIsCopied] = useState(false);

  // Mistral API Key state
  const [mistralKey, setMistralKey] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("koko_mistral_api_key") ||
        localStorage.getItem("mistral_api_key") ||
        ""
      );
    }
    return "";
  });
  const [showMistralKey, setShowMistralKey] = useState<boolean>(false);
  const [isMistralKeySaved, setIsMistralKeySaved] = useState<boolean>(false);

  // llama.cpp Server Base URL state
  const [llamacppUrl, setLlamacppUrl] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("koko_llamacpp_url") ||
        localStorage.getItem("llamacpp_base_url") ||
        "http://127.0.0.1:8080/v1"
      );
    }
    return "http://127.0.0.1:8080/v1";
  });
  const [isLlamacppUrlSaved, setIsLlamacppUrlSaved] = useState<boolean>(false);

  // Server keys configured broadcast state
  const [serverKeysConfigured, setServerKeysConfigured] = useState<Record<string, boolean>>(() => {
    return avatarSocket.getLastConfig()?.api_keys_configured || {};
  });

  // Sync state if props change from outside
  useEffect(() => {
    if (currentProvider) {
      const normalized: "mistral" | "llama_cpp" =
        (currentProvider === "llama_cpp" || currentProvider === "llamacpp") ? "llama_cpp" : "mistral";
      if (normalized !== provider) {
        setProvider(normalized);
      }
    }
  }, [currentProvider]);

  useEffect(() => {
    if (currentModel && currentModel !== model) {
      setModel(currentModel);
    }
  }, [currentModel]);

  useEffect(() => {
    if (currentToolsEnabled !== undefined && currentToolsEnabled !== toolsEnabled) {
      setToolsEnabled(currentToolsEnabled);
    }
  }, [currentToolsEnabled]);

  // Listen to live config broadcast from backend
  useEffect(() => {
    avatarSocket.requestConfig();
    const cached = avatarSocket.getLastConfig();
    if (cached?.api_keys_configured) {
      setServerKeysConfigured(cached.api_keys_configured);
    }

    const unsubscribe = avatarEvents.subscribe("config", (event) => {
      if (event.llm_provider) {
        const p: "mistral" | "llama_cpp" =
          (event.llm_provider === "llama_cpp" || event.llm_provider === "llamacpp") ? "llama_cpp" : "mistral";
        setProvider(p);
      }
      if (event.llm_model) {
        setModel(event.llm_model);
      }
      if (typeof event.tool_calling_enabled === "boolean") {
        setToolsEnabled(event.tool_calling_enabled);
      }
      if (event.api_keys_configured) {
        setServerKeysConfigured(event.api_keys_configured);
      }
    });
    return unsubscribe;
  }, []);

  const activeProviderDetail =
    PROVIDERS.find((p) => p.id === provider) || PROVIDERS[0];

  const activeModelDetail =
    activeProviderDetail.models.find((m) => m.id === model) ||
    activeProviderDetail.models[0];

  const isCurrentModelToolSupported = activeModelDetail?.toolCallingSupported ?? false;
  const isMistralConfigured = Boolean(mistralKey.trim() || serverKeysConfigured["mistral"]);

  const handleSaveMistralKey = () => {
    const trimmed = mistralKey.trim();
    if (typeof window !== "undefined") {
      if (trimmed) {
        localStorage.setItem("koko_mistral_api_key", trimmed);
      } else {
        localStorage.removeItem("koko_mistral_api_key");
      }
    }
    avatarSocket.setApiKey("mistral", trimmed);
    setIsMistralKeySaved(true);
    setTimeout(() => setIsMistralKeySaved(false), 2500);
  };

  const handleClearMistralKey = () => {
    setMistralKey("");
    if (typeof window !== "undefined") {
      localStorage.removeItem("koko_mistral_api_key");
    }
    avatarSocket.setApiKey("mistral", "");
  };

  const handleSaveLlamacppUrl = () => {
    const trimmed = llamacppUrl.trim() || "http://127.0.0.1:8080/v1";
    if (typeof window !== "undefined") {
      localStorage.setItem("koko_llamacpp_url", trimmed);
    }
    avatarSocket.setLlamacppUrl(trimmed);
    setIsLlamacppUrlSaved(true);
    setTimeout(() => setIsLlamacppUrlSaved(false), 2500);
  };

  const handleResetLlamacppUrl = () => {
    const defaultUrl = "http://127.0.0.1:8080/v1";
    setLlamacppUrl(defaultUrl);
    if (typeof window !== "undefined") {
      localStorage.setItem("koko_llamacpp_url", defaultUrl);
    }
    avatarSocket.setLlamacppUrl(defaultUrl);
  };

  const handleSelectProvider = (newProviderId: "mistral" | "llama_cpp") => {
    if (newProviderId === provider) return;
    const targetProviderObj = PROVIDERS.find((p) => p.id === newProviderId)!;
    const defaultModelObj = targetProviderObj.models[0];
    const defaultModel = defaultModelObj.id;

    setProvider(newProviderId);
    setModel(defaultModel);
    onUpdateLlm(newProviderId, defaultModel);

    // If new model does not support tool calling, disable tool calling immediately
    if (!defaultModelObj.toolCallingSupported && toolsEnabled) {
      setToolsEnabled(false);
      onUpdateTools?.(false);
    } else if (defaultModelObj.toolCallingSupported && !toolsEnabled) {
      setToolsEnabled(true);
      onUpdateTools?.(true);
    }
  };

  const handleSelectModel = (newModelId: string) => {
    const selectedModelObj = activeProviderDetail.models.find((m) => m.id === newModelId);
    setModel(newModelId);
    onUpdateLlm(provider, newModelId);

    // If newly chosen model does not support tool calling, automatically disable
    if (selectedModelObj && !selectedModelObj.toolCallingSupported && toolsEnabled) {
      setToolsEnabled(false);
      onUpdateTools?.(false);
    } else if (selectedModelObj && selectedModelObj.toolCallingSupported && !toolsEnabled) {
      setToolsEnabled(true);
      onUpdateTools?.(true);
    }
  };

  const handleToggleTools = () => {
    if (!isCurrentModelToolSupported) return;
    const nextState = !toolsEnabled;
    setToolsEnabled(nextState);
    onUpdateTools?.(nextState);
  };

  const currentUrlPreview =
    typeof window !== "undefined"
      ? `${window.location.origin}/?screen=settings&character=${encodeURIComponent(currentCharacter)}&model=${model}`
      : `/?screen=settings&character=${encodeURIComponent(currentCharacter)}&model=${model}`;

  const copyUrl = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(currentUrlPreview);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="settings-screen-root" aria-label="Application Settings Screen">
      <div className="settings-container">
        {/* ─── Compact Header ────────────────────────────────────────── */}
        <header className="settings-header">
          <div className="settings-category-tag">PREFERENCES</div>
          <h1 className="settings-title">Settings</h1>
          <p className="settings-subtitle">
            Configure AI inference provider, language reasoning model, tool capabilities, and URL synchronization.
          </p>
        </header>

        {/* ─── Provider Segmented Selector (Only Mistral AI and llama.cpp) ─── */}
        <section className="settings-section" aria-labelledby="provider-heading">
          <div className="section-label-row">
            <IconCpu size={16} className="section-icon" />
            <span id="provider-heading" className="section-label">
              Inference Provider
            </span>
          </div>

          <div className="provider-segment-group">
            {PROVIDERS.map((p) => {
              const isSelected = provider === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`provider-segment-btn ${isSelected ? "active" : ""}`}
                  onClick={() => handleSelectProvider(p.id)}
                  aria-pressed={isSelected}
                >
                  <span className="segment-btn-dot" />
                  <span className="segment-btn-name">{p.name}</span>
                  <span className="segment-btn-badge">{p.badge}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ─── Mistral AI Key Configuration ─────────────────────────── */}
        {provider === "mistral" && (
          <section className="settings-section api-key-section" aria-labelledby="mistral-key-heading">
            <div className="section-label-row">
              <IconKey size={16} className="section-icon" />
              <span id="mistral-key-heading" className="section-label">
                Mistral AI API Key
              </span>
              <span className={`api-key-status-pill ${isMistralConfigured ? "configured" : "required"}`}>
                <span className="status-dot" />
                {isMistralConfigured ? "Key Active" : "Key Required"}
              </span>
            </div>

            <div className="api-key-card">
              <p className="api-key-instructions">
                Enter your official Mistral API key (<span className="code-hint">MISTRAL_API_KEY</span>) to power Ministral 8B, Pixtral 12B Vision, and Mistral Small reasoning models.
              </p>

              <div className="api-key-input-wrapper">
                <input
                  type={showMistralKey ? "text" : "password"}
                  className="api-key-input"
                  placeholder={
                    serverKeysConfigured["mistral"]
                      ? "Configured in server .env (MISTRAL_API_KEY)"
                      : "Enter Mistral API Key..."
                  }
                  value={mistralKey}
                  onChange={(e) => setMistralKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveMistralKey()}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="api-key-toggle-btn"
                  onClick={() => setShowMistralKey(!showMistralKey)}
                  title={showMistralKey ? "Hide API Key" : "Show API Key"}
                  aria-label={showMistralKey ? "Hide API Key" : "Show API Key"}
                >
                  {showMistralKey ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>

              <div className="api-key-actions-row">
                <button
                  type="button"
                  className={`api-key-save-btn ${isMistralKeySaved ? "saved" : ""}`}
                  onClick={handleSaveMistralKey}
                >
                  {isMistralKeySaved ? (
                    <>
                      <IconCheck size={14} stroke={3} />
                      <span>Saved & Synced</span>
                    </>
                  ) : (
                    <span>Save & Use Key</span>
                  )}
                </button>
                {mistralKey && (
                  <button
                    type="button"
                    className="api-key-clear-btn"
                    onClick={handleClearMistralKey}
                  >
                    Clear Key
                  </button>
                )}
              </div>

              <div className="api-key-security-note">
                {serverKeysConfigured["mistral"] ? (
                  <>
                    <IconCheck size={14} className="note-icon" style={{ color: "#34d399" }} />
                    <span style={{ color: "#a7f3d0" }}>
                      Active from server environment (<span className="code-hint">MISTRAL_API_KEY</span>). Ready for inference.
                    </span>
                  </>
                ) : (
                  <>
                    <IconAlertCircle size={13} className="note-icon" />
                    <span>
                      Keys are stored locally in your browser and synced directly to your running server session.
                    </span>
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ─── llama.cpp Local Endpoint Configuration ───────────────── */}
        {provider === "llama_cpp" && (
          <section className="settings-section api-key-section" aria-labelledby="llamacpp-heading">
            <div className="section-label-row">
              <IconServer size={16} className="section-icon" />
              <span id="llamacpp-heading" className="section-label">
                llama.cpp Server Endpoint
              </span>
              <span className="api-key-status-pill configured">
                <span className="status-dot" />
                Local Endpoint
              </span>
            </div>

            <div className="api-key-card">
              <p className="api-key-instructions">
                Connect to a local or LAN llama-server instance running Google Gemma 4 GGUF with native tool calling.
              </p>

              <div className="api-key-input-wrapper">
                <input
                  type="text"
                  className="api-key-input"
                  placeholder="http://127.0.0.1:8080/v1"
                  value={llamacppUrl}
                  onChange={(e) => setLlamacppUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveLlamacppUrl()}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="api-key-actions-row">
                <button
                  type="button"
                  className={`api-key-save-btn ${isLlamacppUrlSaved ? "saved" : ""}`}
                  onClick={handleSaveLlamacppUrl}
                >
                  {isLlamacppUrlSaved ? (
                    <>
                      <IconCheck size={14} stroke={3} />
                      <span>Endpoint Synced</span>
                    </>
                  ) : (
                    <span>Save & Connect</span>
                  )}
                </button>
                <button
                  type="button"
                  className="api-key-clear-btn"
                  onClick={handleResetLlamacppUrl}
                >
                  <IconRefresh size={13} style={{ marginRight: 4 }} />
                  Reset Default
                </button>
              </div>

              <div className="api-key-security-note">
                <IconAlertCircle size={13} className="note-icon" />
                <span>
                  Start command: <span className="code-hint">llama-server.exe -hf ggml-org/gemma-4-E2B-it-GGUF:Q4_0 -c 8192 --port 8080</span>
                </span>
              </div>
            </div>
          </section>
        )}

        {/* ─── Compact Model List ────────────────────────────────────── */}
        <section className="settings-section" aria-labelledby="model-heading">
          <div className="section-label-row">
            <IconSparkles size={16} className="section-icon sparkles" />
            <span id="model-heading" className="section-label">
              Model Selection
            </span>
            <span className="section-count-badge">
              {activeProviderDetail.models.length} available
            </span>
          </div>

          <div className="compact-model-list" role="radiogroup" aria-labelledby="model-heading">
            {activeProviderDetail.models.map((m) => {
              const isSelected = model === m.id;
              return (
                <div
                  key={m.id}
                  className={`compact-model-row ${isSelected ? "selected" : ""}`}
                  onClick={() => handleSelectModel(m.id)}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && handleSelectModel(m.id)}
                >
                  <div className={`row-radio-indicator ${isSelected ? "active" : ""}`}>
                    {isSelected && <IconCheck size={12} stroke={3} />}
                  </div>

                  <div className="row-info-col">
                    <div className="row-title-line">
                      <span className="row-model-name">{m.name}</span>
                      {m.badge && (
                        <span
                          className={`row-badge ${
                            m.badge.includes("Recommended") ? "recommended" : ""
                          }`}
                        >
                          {m.badge}
                        </span>
                      )}
                      {m.toolCallingSupported ? (
                        <span className="row-tool-badge supported" title="Supports Tool Calling">
                          Tools Ready
                        </span>
                      ) : (
                        <span className="row-tool-badge unsupported" title="Tool Calling Not Supported">
                          No Tools
                        </span>
                      )}
                      {m.visionSupported && (
                        <span
                          className="row-tool-badge supported"
                          style={{
                            borderColor: "rgba(168, 85, 247, 0.4)",
                            color: "#c084fc",
                            background: "rgba(168, 85, 247, 0.12)",
                          }}
                          title="Natively Supports Multimodal Vision"
                        >
                          Vision
                        </span>
                      )}
                    </div>
                    <code className="row-model-id">{m.id}</code>
                  </div>

                  <span className="row-context-tag">{m.context}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── Dedicated Tool Calling Configuration Section ───────────── */}
        <section className="settings-section" aria-labelledby="tools-heading">
          <div className="section-label-row">
            <IconTools size={16} className="section-icon" />
            <span id="tools-heading" className="section-label">
              Tool Calling Capability
            </span>
            <span
              className={`capability-status-tag ${
                isCurrentModelToolSupported ? "supported" : "unsupported"
              }`}
            >
              {isCurrentModelToolSupported ? "Model Supported" : "Model Unsupported"}
            </span>
          </div>

          <div className={`tools-master-card ${!isCurrentModelToolSupported ? "disabled-card" : ""}`}>
            <div className="tools-card-header">
              <div className="tools-card-text">
                <div className="tools-card-title">
                  <span>Enable Tool Calling</span>
                  {isCurrentModelToolSupported ? (
                    <span className="tool-card-badge active">Supported by {activeModelDetail.name}</span>
                  ) : (
                    <span className="tool-card-badge inactive">Incompatible with {activeModelDetail.name}</span>
                  )}
                </div>
                <p className="tools-card-desc">
                  {isCurrentModelToolSupported
                    ? "Allows Koko to invoke host computer tools, live web search, safe math, and system sensors to provide accurate answers without hallucinating."
                    : "The selected model does not support tool calling. Choose Ministral 8B, Mistral Small, or Gemma 4 to enable this feature."}
                </p>
              </div>

              <button
                type="button"
                className={`tool-toggle-btn ${
                  toolsEnabled && isCurrentModelToolSupported ? "active" : ""
                } ${!isCurrentModelToolSupported ? "disabled" : ""}`}
                onClick={handleToggleTools}
                disabled={!isCurrentModelToolSupported}
                aria-pressed={toolsEnabled && isCurrentModelToolSupported}
                title={
                  !isCurrentModelToolSupported
                    ? "The selected model does not support tool calling"
                    : toolsEnabled
                    ? "Click to disable tool calling"
                    : "Click to enable tool calling"
                }
              >
                <span className="tool-toggle-track">
                  <span className="tool-toggle-thumb" />
                </span>
                <span className="tool-toggle-label">
                  {!isCurrentModelToolSupported ? "Disabled" : toolsEnabled ? "ON" : "OFF"}
                </span>
              </button>
            </div>

            {/* Available Tools Grid - Showing ONLY tools used in this codebase */}
            <div className="available-tools-header">
              <span className="available-tools-title">Available Tools</span>
              <span
                className="available-tools-limit"
                title="Safety limit: Maximum number of sequential tool execution iterations permitted within a single user message turn."
              >
                Max: 20 rounds / turn
              </span>
            </div>

            <div className="available-tools-grid">
              {/* Tool 1: Bash Terminal */}
              <div
                className={`tool-item-card ${
                  isCurrentModelToolSupported && toolsEnabled ? "active" : "dormant"
                }`}
              >
                <div className="tool-item-icon-box">
                  <IconTerminal2 size={16} />
                </div>
                <div className="tool-item-info">
                  <div className="tool-item-name-row">
                    <span className="tool-item-name">Bash Terminal</span>
                    <span className="tool-item-status">
                      {isCurrentModelToolSupported && toolsEnabled ? "Ready" : "Inactive"}
                    </span>
                  </div>
                  <span className="tool-item-desc">
                    Executes host shell commands directly in D:/developer/
                  </span>
                </div>
              </div>

              {/* Tool 2: File Manager */}
              <div
                className={`tool-item-card ${
                  isCurrentModelToolSupported && toolsEnabled ? "active" : "dormant"
                }`}
              >
                <div className="tool-item-icon-box">
                  <IconFileCode size={16} />
                </div>
                <div className="tool-item-info">
                  <div className="tool-item-name-row">
                    <span className="tool-item-name">File Manager</span>
                    <span className="tool-item-status">
                      {isCurrentModelToolSupported && toolsEnabled ? "Ready" : "Inactive"}
                    </span>
                  </div>
                  <span className="tool-item-desc">
                    Full read, write, edit, and directory operations in D:/developer/
                  </span>
                </div>
              </div>

              {/* Tool 3: Web Search */}
              <div
                className={`tool-item-card ${
                  isCurrentModelToolSupported && toolsEnabled ? "active" : "dormant"
                }`}
              >
                <div className="tool-item-icon-box">
                  <IconSearch size={16} />
                </div>
                <div className="tool-item-info">
                  <div className="tool-item-name-row">
                    <span className="tool-item-name">Web Search</span>
                    <span className="tool-item-status">
                      {isCurrentModelToolSupported && toolsEnabled ? "Ready" : "Inactive"}
                    </span>
                  </div>
                  <span className="tool-item-desc">
                    Searches live web & news via Tavily AI or DuckDuckGo
                  </span>
                </div>
              </div>

              {/* Tool 4: Web Page Reader */}
              <div
                className={`tool-item-card ${
                  isCurrentModelToolSupported && toolsEnabled ? "active" : "dormant"
                }`}
              >
                <div className="tool-item-icon-box">
                  <IconWorld size={16} />
                </div>
                <div className="tool-item-info">
                  <div className="tool-item-name-row">
                    <span className="tool-item-name">Web Page Reader</span>
                    <span className="tool-item-status">
                      {isCurrentModelToolSupported && toolsEnabled ? "Ready" : "Inactive"}
                    </span>
                  </div>
                  <span className="tool-item-desc">
                    Directly reads and extracts full text from websites
                  </span>
                </div>
              </div>

              {/* Tool 5: Calculator */}
              <div
                className={`tool-item-card ${
                  isCurrentModelToolSupported && toolsEnabled ? "active" : "dormant"
                }`}
              >
                <div className="tool-item-icon-box">
                  <IconCalculator size={16} />
                </div>
                <div className="tool-item-info">
                  <div className="tool-item-name-row">
                    <span className="tool-item-name">Calculator</span>
                    <span className="tool-item-status">
                      {isCurrentModelToolSupported && toolsEnabled ? "Ready" : "Inactive"}
                    </span>
                  </div>
                  <span className="tool-item-desc">
                    Safe AST math, arithmetic, powers, and percentages
                  </span>
                </div>
              </div>

              {/* Tool 6: System Status */}
              <div
                className={`tool-item-card ${
                  isCurrentModelToolSupported && toolsEnabled ? "active" : "dormant"
                }`}
              >
                <div className="tool-item-icon-box">
                  <IconDeviceDesktopAnalytics size={16} />
                </div>
                <div className="tool-item-info">
                  <div className="tool-item-name-row">
                    <span className="tool-item-name">System Status</span>
                    <span className="tool-item-status">
                      {isCurrentModelToolSupported && toolsEnabled ? "Ready" : "Inactive"}
                    </span>
                  </div>
                  <span className="tool-item-desc">
                    Checks CPU, RAM, OS runtime, and server health
                  </span>
                </div>
              </div>

              {/* Tool 7: Clock & Timezone */}
              <div
                className={`tool-item-card ${
                  isCurrentModelToolSupported && toolsEnabled ? "active" : "dormant"
                }`}
              >
                <div className="tool-item-icon-box">
                  <IconClock size={16} />
                </div>
                <div className="tool-item-info">
                  <div className="tool-item-name-row">
                    <span className="tool-item-name">Clock & Time</span>
                    <span className="tool-item-status">
                      {isCurrentModelToolSupported && toolsEnabled ? "Ready" : "Inactive"}
                    </span>
                  </div>
                  <span className="tool-item-desc">
                    Live 12h/24h time, worldwide timezones, and city offsets
                  </span>
                </div>
              </div>

              {/* Tool 8: Calendar & Date */}
              <div
                className={`tool-item-card ${
                  isCurrentModelToolSupported && toolsEnabled ? "active" : "dormant"
                }`}
              >
                <div className="tool-item-icon-box">
                  <IconCalendar size={16} />
                </div>
                <div className="tool-item-info">
                  <div className="tool-item-name-row">
                    <span className="tool-item-name">Calendar & Date</span>
                    <span className="tool-item-status">
                      {isCurrentModelToolSupported && toolsEnabled ? "Ready" : "Inactive"}
                    </span>
                  </div>
                  <span className="tool-item-desc">
                    Retrieves day, month, year, weekdays, and relative dates
                  </span>
                </div>
              </div>

              {/* Tool 9: Tool Discovery */}
              <div
                className={`tool-item-card ${
                  isCurrentModelToolSupported && toolsEnabled ? "active" : "dormant"
                }`}
              >
                <div className="tool-item-icon-box">
                  <IconSparkles size={16} />
                </div>
                <div className="tool-item-info">
                  <div className="tool-item-name-row">
                    <span className="tool-item-name">Tool Discovery</span>
                    <span className="tool-item-status">
                      {isCurrentModelToolSupported && toolsEnabled ? "Ready" : "Inactive"}
                    </span>
                  </div>
                  <span className="tool-item-desc">
                    Dynamic tool catalog inspection before declining requests
                  </span>
                </div>
              </div>
            </div>

            {!isCurrentModelToolSupported && (
              <div className="unsupported-model-warning">
                <IconAlertCircle size={15} />
                <span>
                  Tool Calling is disabled because <strong>{activeModelDetail.name}</strong> lacks native function calling capabilities.
                </span>
              </div>
            )}
          </div>
        </section>

        {/* ─── Slim URL Sync Bar ─────────────────────────────────────── */}
        <section className="settings-section" aria-labelledby="sync-heading">
          <div className="section-label-row">
            <IconLink size={15} className="section-icon" />
            <span id="sync-heading" className="section-label">
              URL Synchronization
            </span>
          </div>

          <div className="slim-sync-bar">
            <div className="sync-bar-left">
              <span className="sync-live-dot" />
              <code className="sync-url-text">
                {`?screen=settings&character=${currentCharacter}&model=${model}`}
              </code>
            </div>

            <button
              type="button"
              className="sync-copy-btn"
              onClick={copyUrl}
              title="Copy URL parameter link"
            >
              {isCopied ? <IconChecklist size={14} /> : <IconCopy size={14} />}
              <span>{isCopied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </section>

        {/* Bottom margin spacer for scrolling clearance */}
        <div className="settings-bottom-spacer" />
      </div>
    </div>
  );
};
export default SettingsScreen;
