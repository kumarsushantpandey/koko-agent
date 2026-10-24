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
  IconArrowsExchange,
  IconWorld,
  IconCalendarTime,
  IconKey,
  IconEye,
  IconEyeOff,
  IconSearch,
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

interface ModelDetail {
  id: string;
  name: string;
  badge?: string;
  context: string;
  toolCallingSupported: boolean;
  visionSupported?: boolean;
}

interface ProviderDetail {
  id: "mistral" | "openai" | "freeai" | "openrouter" | "bedrock";
  name: string;
  badge: string;
  toolCallingSupported: boolean;
  visionSupported?: boolean;
  models: ModelDetail[];
}

const PROVIDERS: ProviderDetail[] = [
  {
    id: "openai",
    name: "OpenAI",
    badge: "GPT Frontier",
    toolCallingSupported: true,
    visionSupported: true,
    models: [
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        badge: "Recommended",
        context: "128k context",
        toolCallingSupported: true,
        visionSupported: true,
      },
      {
        id: "gpt-4o",
        name: "GPT-4o",
        badge: "Flagship",
        context: "128k context",
        toolCallingSupported: true,
        visionSupported: true,
      },
      {
        id: "gpt-4-turbo",
        name: "GPT-4 Turbo",
        badge: "Frontier",
        context: "128k context",
        toolCallingSupported: true,
        visionSupported: true,
      },
      {
        id: "gpt-3.5-turbo",
        name: "GPT-3.5 Turbo",
        badge: "Legacy",
        context: "16k context",
        toolCallingSupported: true,
        visionSupported: false,
      },
    ],
  },
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
      {
        id: "open-mistral-7b",
        name: "Open Mistral 7B",
        badge: "Baseline",
        context: "32k context",
        toolCallingSupported: true,
        visionSupported: false,
      },
    ],
  },
  {
    id: "freeai",
    name: "Free.ai",
    badge: "Free Gateway",
    toolCallingSupported: true,
    visionSupported: false,
    models: [
      {
        id: "qwen7b",
        name: "Qwen 2.5 7B",
        badge: "Recommended",
        context: "32k context",
        toolCallingSupported: true,
        visionSupported: false,
      },
      {
        id: "qwen3-8b",
        name: "Qwen 3 8B",
        badge: "Next-Gen",
        context: "32k context",
        toolCallingSupported: true,
        visionSupported: false,
      },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter (Free)",
    badge: "Free Tier",
    toolCallingSupported: true,
    visionSupported: true,
    models: [
      {
        id: "openrouter/free",
        name: "Free Models Router",
        badge: "Auto (Recommended)",
        context: "200k context",
        toolCallingSupported: true,
        visionSupported: true,
      },
      {
        id: "inclusionai/ling-3.0-flash-sante:free",
        name: "Ling 3.0 Flash",
        badge: "Fast",
        context: "262k context",
        toolCallingSupported: true,
      },
      {
        id: "liquid/lfm-2.5-2.6b:free",
        name: "Liquid LFM 2.5",
        badge: "Lightweight",
        context: "65k context",
        toolCallingSupported: true,
      },
      {
        id: "stealth/space-bunny-alpha",
        name: "Space Bunny Alpha",
        badge: "1M Context",
        context: "1M context",
        toolCallingSupported: true,
      },
      {
        id: "poolside/laguna-s-2.1:free",
        name: "Laguna S 2.1",
        badge: "Reasoning",
        context: "262k context",
        toolCallingSupported: true,
      },
      {
        id: "qwen/qwen3.8-27b:free",
        name: "Qwen 3.8 27B",
        badge: "Multilingual",
        context: "262k context",
        toolCallingSupported: true,
      },
      {
        id: "google/gemma-4-31b-it:free",
        name: "Google Gemma 4 31B (Free)",
        badge: "Tool Native",
        context: "256k context",
        toolCallingSupported: true,
        visionSupported: true,
      },
      {
        id: "google/gemma-4-26b-a4b-it:free",
        name: "Google Gemma 4 26B A4B (Free)",
        badge: "MoE Free",
        context: "128k context",
        toolCallingSupported: true,
        visionSupported: true,
      },
    ],
  },
  {
    id: "bedrock",
    name: "AWS Bedrock",
    badge: "Enterprise",
    toolCallingSupported: true,
    visionSupported: true,
    models: [
      {
        id: "mistral.ministral-3-8b-instruct",
        name: "Ministral 3 8B",
        badge: "Recommended",
        context: "128k context",
        toolCallingSupported: true,
        visionSupported: true,
      },
      {
        id: "mistral.ministral-3-14b-instruct",
        name: "Ministral 3 14B",
        badge: "Reasoning",
        context: "128k context",
        toolCallingSupported: true,
        visionSupported: true,
      },
      {
        id: "mistral.mistral-large-3-675b-instruct",
        name: "Mistral Large 3 675B",
        badge: "Flagship",
        context: "128k context",
        toolCallingSupported: true,
        visionSupported: true,
      },
      {
        id: "qwen.qwen3-vl-235b-a22b-instruct",
        name: "Qwen 3 VL 235B",
        badge: "Vision Flagship",
        context: "128k context",
        toolCallingSupported: true,
        visionSupported: true,
      },
      {
        id: "qwen.qwen3-32b",
        name: "Qwen 3 32B",
        badge: "High Reasoning",
        context: "32k context",
        toolCallingSupported: true,
        visionSupported: false,
      },
      {
        id: "openai.gpt-oss-120b",
        name: "OpenAI GPT-OSS 120B",
        badge: "Reasoning Flagship",
        context: "128k context",
        toolCallingSupported: true,
        visionSupported: false,
      },
      {
        id: "openai.gpt-oss-20b",
        name: "OpenAI GPT-OSS 20B",
        badge: "Fast Reasoning",
        context: "128k context",
        toolCallingSupported: true,
        visionSupported: false,
      },
      {
        id: "google.gemma-3-4b-it",
        name: "Google Gemma 3 4B",
        badge: "Fast",
        context: "32k context",
        toolCallingSupported: false,
        visionSupported: false,
      },
      {
        id: "google.gemma-3-12b-it",
        name: "Google Gemma 3 12B",
        badge: "Smart",
        context: "32k context",
        toolCallingSupported: false,
        visionSupported: false,
      },
      {
        id: "google.gemma-3-27b-it",
        name: "Google Gemma 3 27B",
        badge: "Frontier",
        context: "32k context",
        toolCallingSupported: false,
        visionSupported: false,
      },
      {
        id: "deepseek.v3.1",
        name: "DeepSeek V3.1",
        badge: "Reasoning",
        context: "64k context",
        toolCallingSupported: true,
        visionSupported: false,
      },
      {
        id: "deepseek.v3.2",
        name: "DeepSeek V3.2",
        badge: "Deep Reasoning",
        context: "64k context",
        toolCallingSupported: true,
        visionSupported: false,
      },
      {
        id: "zai.glm-5",
        name: "Zhipu GLM 5",
        badge: "Frontier",
        context: "128k context",
        toolCallingSupported: true,
        visionSupported: false,
      },
      {
        id: "moonshotai.kimi-k2.5",
        name: "Moonshot Kimi K2.5",
        badge: "Multilingual",
        context: "128k context",
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
  currentToolsEnabled = false,
  onUpdateLlm,
  onUpdateTools,
}) => {
  const [provider, setProvider] = useState<string>(currentProvider || "mistral");
  const [model, setModel] = useState<string>(currentModel || "ministral-8b-latest");
  const [toolsEnabled, setToolsEnabled] = useState<boolean>(currentToolsEnabled);
  const [isCopied, setIsCopied] = useState(false);
  const [openAiKey, setOpenAiKey] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("akari_openai_api_key") || "";
    }
    return "";
  });
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isKeySaved, setIsKeySaved] = useState<boolean>(false);

  const [bedrockToken, setBedrockToken] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("akari_bedrock_bearer_token") || "";
    }
    return "";
  });
  const [showBedrockToken, setShowBedrockToken] = useState<boolean>(false);
  const [isBedrockKeySaved, setIsBedrockKeySaved] = useState<boolean>(false);

  const [serverKeysConfigured, setServerKeysConfigured] = useState<Record<string, boolean>>(() => {
    return avatarSocket.getLastConfig()?.api_keys_configured || {};
  });

  // Sync state if props change from outside (e.g. browser back/forward)
  useEffect(() => {
    if (currentProvider && currentProvider !== provider) {
      setProvider(currentProvider);
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
        setProvider(event.llm_provider);
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
  const isOpenAiConfigured = Boolean(openAiKey.trim() || serverKeysConfigured["openai"]);
  const isBedrockConfigured = Boolean(bedrockToken.trim() || serverKeysConfigured["bedrock"]);

  const handleSaveApiKey = () => {
    const trimmed = openAiKey.trim();
    if (typeof window !== "undefined") {
      if (trimmed) {
        localStorage.setItem("akari_openai_api_key", trimmed);
      } else {
        localStorage.removeItem("akari_openai_api_key");
      }
    }
    avatarSocket.setApiKey("openai", trimmed);
    setIsKeySaved(true);
    setTimeout(() => setIsKeySaved(false), 2500);
  };

  const handleClearApiKey = () => {
    setOpenAiKey("");
    if (typeof window !== "undefined") {
      localStorage.removeItem("akari_openai_api_key");
    }
    avatarSocket.setApiKey("openai", "");
  };

  const handleSaveBedrockToken = () => {
    const trimmed = bedrockToken.trim();
    if (typeof window !== "undefined") {
      if (trimmed) {
        localStorage.setItem("akari_bedrock_bearer_token", trimmed);
      } else {
        localStorage.removeItem("akari_bedrock_bearer_token");
      }
    }
    avatarSocket.setApiKey("bedrock", trimmed);
    setIsBedrockKeySaved(true);
    setTimeout(() => setIsBedrockKeySaved(false), 2500);
  };

  const handleClearBedrockToken = () => {
    setBedrockToken("");
    if (typeof window !== "undefined") {
      localStorage.removeItem("akari_bedrock_bearer_token");
    }
    avatarSocket.setApiKey("bedrock", "");
  };

  const handleSelectProvider = (newProviderId: "mistral" | "openai" | "freeai" | "openrouter" | "bedrock") => {
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
      // Automatically re-enable tool calling when selecting a tool-capable model (e.g. GPT-OSS 120B)
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

        {/* ─── Provider Segmented Selector ───────────────────────────── */}
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

        {/* ─── OpenAI API Key Configuration (When OpenAI is selected) ─── */}
        {provider === "openai" && (
          <section className="settings-section api-key-section" aria-labelledby="apikey-heading">
            <div className="section-label-row">
              <IconKey size={16} className="section-icon" />
              <span id="apikey-heading" className="section-label">
                OpenAI API Key
              </span>
              <span className={`api-key-status-pill ${isOpenAiConfigured ? "configured" : "required"}`}>
                <span className="status-dot" />
                {isOpenAiConfigured ? "Key Active" : "Key Required"}
              </span>
            </div>

            <div className="api-key-card">
              <p className="api-key-instructions">
                Enter your official OpenAI API key (<span className="code-hint">sk-...</span>) to use GPT-4o, GPT-4o Mini, tool calling, and multimodal vision.
              </p>

              <div className="api-key-input-wrapper">
                <input
                  type={showKey ? "text" : "password"}
                  className="api-key-input"
                  placeholder="sk-proj-... or sk-..."
                  value={openAiKey}
                  onChange={(e) => setOpenAiKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveApiKey()}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="api-key-toggle-btn"
                  onClick={() => setShowKey(!showKey)}
                  title={showKey ? "Hide API Key" : "Show API Key"}
                  aria-label={showKey ? "Hide API Key" : "Show API Key"}
                >
                  {showKey ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>

              <div className="api-key-actions-row">
                <button
                  type="button"
                  className={`api-key-save-btn ${isKeySaved ? "saved" : ""}`}
                  onClick={handleSaveApiKey}
                >
                  {isKeySaved ? (
                    <>
                      <IconCheck size={14} stroke={3} />
                      <span>Saved & Synced</span>
                    </>
                  ) : (
                    <span>Save & Use Key</span>
                  )}
                </button>
                {openAiKey && (
                  <button
                    type="button"
                    className="api-key-clear-btn"
                    onClick={handleClearApiKey}
                  >
                    Clear Key
                  </button>
                )}
              </div>

              <div className="api-key-security-note">
                <IconAlertCircle size={13} className="note-icon" />
                <span>
                  Keys are stored locally in your browser and synced directly to your running backend session.
                </span>
              </div>
            </div>
          </section>
        )}

        {/* ─── AWS Bedrock Bearer Token Configuration (When Bedrock is selected) ─── */}
        {provider === "bedrock" && (
          <section className="settings-section api-key-section" aria-labelledby="bedrock-heading">
            <div className="section-label-row">
              <IconKey size={16} className="section-icon" />
              <span id="bedrock-heading" className="section-label">
                AWS Bedrock Bearer Token
              </span>
              <span className={`api-key-status-pill ${isBedrockConfigured ? "configured" : "required"}`}>
                <span className="status-dot" />
                {isBedrockConfigured ? "Token Active" : "Token Required"}
              </span>
            </div>

            <div className="api-key-card">
              <p className="api-key-instructions">
                Enter your Amazon Bedrock API key / Bearer Token (<span className="code-hint">bedrock-api-key-...</span>) to use Ministral 3, Gemma 4 (tool calling enabled), Gemma 3, Qwen 3, and Claude models.
              </p>

              <div className="api-key-input-wrapper">
                <input
                  type={showBedrockToken ? "text" : "password"}
                  className="api-key-input"
                  placeholder={
                    serverKeysConfigured["bedrock"]
                      ? "Configured in server .env (AWS_BEARER_TOKEN_BEDROCK)"
                      : "bedrock-api-key-..."
                  }
                  value={bedrockToken}
                  onChange={(e) => setBedrockToken(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveBedrockToken()}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="api-key-toggle-btn"
                  onClick={() => setShowBedrockToken(!showBedrockToken)}
                  title={showBedrockToken ? "Hide Bearer Token" : "Show Bearer Token"}
                  aria-label={showBedrockToken ? "Hide Bearer Token" : "Show Bearer Token"}
                >
                  {showBedrockToken ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>

              <div className="api-key-actions-row">
                <button
                  type="button"
                  className={`api-key-save-btn ${isBedrockKeySaved ? "saved" : ""}`}
                  onClick={handleSaveBedrockToken}
                >
                  {isBedrockKeySaved ? (
                    <>
                      <IconCheck size={14} stroke={3} />
                      <span>Saved & Synced</span>
                    </>
                  ) : (
                    <span>Save & Use Token</span>
                  )}
                </button>
                {bedrockToken && (
                  <button
                    type="button"
                    className="api-key-clear-btn"
                    onClick={handleClearBedrockToken}
                  >
                    Clear Token
                  </button>
                )}
              </div>

              <div className="api-key-security-note">
                {serverKeysConfigured["bedrock"] ? (
                  <>
                    <IconCheck size={14} className="note-icon" style={{ color: "#34d399" }} />
                    <span style={{ color: "#a7f3d0" }}>
                      Active from server environment (<span className="code-hint">AWS_BEARER_TOKEN_BEDROCK</span>). Ready for inference.
                    </span>
                  </>
                ) : (
                  <>
                    <IconAlertCircle size={13} className="note-icon" />
                    <span>
                      Configured in <span className="code-hint">AWS_BEARER_TOKEN_BEDROCK</span> or saved directly to your session.
                    </span>
                  </>
                )}
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
                    ? "Allow's to invoke external tools (such as live time, date, and system status) to provide accurate answers rather than hallucinating."
                    : "The selected model does not support tool calling. Choose a compatible model (e.g. Ministral 8B or Qwen 2.5 7B) to enable this feature."}
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

            {/* Available Tools Grid */}
            <div className="available-tools-header">
              <span className="available-tools-title">Available Tools</span>
              <span
                className="available-tools-limit"
                title="Safety limit: Maximum number of sequential tool execution iterations permitted within a single user message turn to prevent runaway loops."
              >
                Max: 5 rounds / turn
              </span>
            </div>

            <div className="available-tools-grid">
              <div
                className={`tool-item-card ${
                  isCurrentModelToolSupported && toolsEnabled ? "active" : "dormant"
                }`}
              >
                <div className="tool-item-icon-box">
                  <IconTools size={16} />
                </div>
                <div className="tool-item-info">
                  <div className="tool-item-name-row">
                    <span className="tool-item-name">Tool Discovery</span>
                    <span className="tool-item-status">
                      {isCurrentModelToolSupported && toolsEnabled ? "Ready" : "Inactive"}
                    </span>
                  </div>
                  <span className="tool-item-desc">
                    Allows model to dynamically list and inspect all capabilities
                  </span>
                </div>
              </div>

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
                    <span className="tool-item-name">Current Time</span>
                    <span className="tool-item-status">
                      {isCurrentModelToolSupported && toolsEnabled ? "Ready" : "Inactive"}
                    </span>
                  </div>
                  <span className="tool-item-desc">
                    Retrieves live time in 12h/24h format for any location
                  </span>
                </div>
              </div>

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
                    <span className="tool-item-name">Timezone Details</span>
                    <span className="tool-item-status">
                      {isCurrentModelToolSupported && toolsEnabled ? "Ready" : "Inactive"}
                    </span>
                  </div>
                  <span className="tool-item-desc">
                    Resolves timezone IANA code, UTC offset, and DST
                  </span>
                </div>
              </div>

              <div
                className={`tool-item-card ${
                  isCurrentModelToolSupported && toolsEnabled ? "active" : "dormant"
                }`}
              >
                <div className="tool-item-icon-box">
                  <IconArrowsExchange size={16} />
                </div>
                <div className="tool-item-info">
                  <div className="tool-item-name-row">
                    <span className="tool-item-name">Time Converter</span>
                    <span className="tool-item-status">
                      {isCurrentModelToolSupported && toolsEnabled ? "Ready" : "Inactive"}
                    </span>
                  </div>
                  <span className="tool-item-desc">
                    Converts specific times between any two cities
                  </span>
                </div>
              </div>

              <div
                className={`tool-item-card ${
                  isCurrentModelToolSupported && toolsEnabled ? "active" : "dormant"
                }`}
              >
                <div className="tool-item-icon-box">
                  <IconArrowsExchange size={16} />
                </div>
                <div className="tool-item-info">
                  <div className="tool-item-name-row">
                    <span className="tool-item-name">Time Difference</span>
                    <span className="tool-item-status">
                      {isCurrentModelToolSupported && toolsEnabled ? "Ready" : "Inactive"}
                    </span>
                  </div>
                  <span className="tool-item-desc">
                    Computes hours offset and compares time zones
                  </span>
                </div>
              </div>

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
                    <span className="tool-item-name">Current Date</span>
                    <span className="tool-item-status">
                      {isCurrentModelToolSupported && toolsEnabled ? "Ready" : "Inactive"}
                    </span>
                  </div>
                  <span className="tool-item-desc">
                    Retrieves current day, month, date, and year
                  </span>
                </div>
              </div>

              <div
                className={`tool-item-card ${
                  isCurrentModelToolSupported && toolsEnabled ? "active" : "dormant"
                }`}
              >
                <div className="tool-item-icon-box">
                  <IconCalendarTime size={16} />
                </div>
                <div className="tool-item-info">
                  <div className="tool-item-name-row">
                    <span className="tool-item-name">Day of Week</span>
                    <span className="tool-item-status">
                      {isCurrentModelToolSupported && toolsEnabled ? "Ready" : "Inactive"}
                    </span>
                  </div>
                  <span className="tool-item-desc">
                    Finds the weekday and relative days for any date
                  </span>
                </div>
              </div>

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
                    Safe AST math, percentages, powers, and expressions
                  </span>
                </div>
              </div>

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
                    Checks system health, OS runtime, and model status
                  </span>
                </div>
              </div>

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
                    Searches live web & news via Tavily AI / DuckDuckGo
                  </span>
                </div>
              </div>

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
                    Directly reads & summarizes specific URLs & websites
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
