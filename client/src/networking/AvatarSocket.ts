/**
 * AvatarSocket
 *
 * WebSocket bridge between the Python server and the browser.
 *
 * Protocol:
 *   - Binary frames → packet[0] is the packet type:
 *       1 = AUDIO_CHUNK     → enqueued on audioQueue for gapless playback
 *       2 = AUDIO_END       → stream finished
 *       3 = AUDIO_INTERRUPT → stop all audio immediately
 *
 *   - JSON text frames → AvatarEvent dispatched on avatarEvents bus:
 *       transcript  → subtitle display
 *       emotion     → VRM expression
 *       animation   → body animation
 *       thinking_*  → UI state
 *       speech_*    → UI state
 *       speech      → carries text/timeline (received but not used for lipsync)
 *
 * LipSync:
 *   Audio-reactive. No timing cursors, no scheduledAt, no delay_ms.
 *   LipSyncController reads live RMS from the AnalyserNode every frame.
 */

import { avatarEvents } from "./EventBus";
import type { AvatarEvent, SpeechSegmentEvent, ConfigEvent } from "./types";
import { audioPlayer } from "../audio/AudioPlayer";
import { audioQueue } from "../audio/AudioQueue";
import { subtitleSync } from "../audio/SubtitleSync";
import { speechQueue } from "../audio/SpeechQueue";

const WS_URL = "ws://127.0.0.1:8765";

const PACKET_AUDIO_CHUNK = 1;
const PACKET_AUDIO_END = 2;
const PACKET_AUDIO_INTERRUPT = 3;

export type ConnectionStatus = "connected" | "connecting" | "disconnected";

/**
 * AvatarSocket handles resilient WebSocket communication, automatic reconnection,
 * and dispatching of streaming audio packets and avatar events.
 */
class AvatarSocket {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private manuallyClosed = false;
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  public lastConfig: ConfigEvent | null = null;
  private currentMode: { chat_input_enabled: boolean; screen: string } = {
    chat_input_enabled: true,
    screen: "characters",
  };
  private pendingLlmProvider: { provider: string; model?: string } | null = (() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const urlModel = params.get("model");
    const model = urlModel || localStorage.getItem("koko_llm_model") || localStorage.getItem("akari_llm_model") || "ministral-8b-latest";
    let provider = localStorage.getItem("koko_llm_provider") || localStorage.getItem("akari_llm_provider") || "mistral";

    if (urlModel) {
      const lower = urlModel.toLowerCase();
      if (lower.includes("gemma") || lower.includes("llama") || lower.includes("ggml") || lower.includes("local")) {
        provider = "llama_cpp";
      } else {
        provider = "mistral";
      }
    }
    return { provider, model };
  })();
  private pendingToolCalling: { enabled: boolean; maxCalls?: number } | null = (() => {
    if (typeof window === "undefined") return null;
    const storedTools = localStorage.getItem("koko_tool_calling_enabled") || localStorage.getItem("akari_tool_calling_enabled");
    const enabled = storedTools !== null ? storedTools === "true" : true;
    return { enabled, maxCalls: 20 };
  })();

  /**
   * Returns the current connection status to the Python backend server.
   */
  getConnectionStatus(): ConnectionStatus {
    if (!this.socket) return "disconnected";
    if (this.socket.readyState === WebSocket.OPEN) return "connected";
    if (this.socket.readyState === WebSocket.CONNECTING) return "connecting";
    return "disconnected";
  }

  /**
   * Subscribes to connection status changes. Invokes callback immediately with current status.
   */
  onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.getConnectionStatus());
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private notifyStatus(status: ConnectionStatus) {
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (err) {
        console.error("[AvatarSocket] Error in status listener", err);
      }
    }
  }

  /**
   * Updates the conversation mode on the backend.
   * - chatInputEnabled = true  -> Chat Mode (browser text/voice input)
   * - chatInputEnabled = false -> Stream Mode (server-side mic & TTS loop)
   */
  setMode(chatInputEnabled: boolean, screenName: string = "") {
    this.currentMode = { chat_input_enabled: chatInputEnabled, screen: screenName };
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log(
        `[AvatarSocket] Sending mode: chat_input_enabled=${chatInputEnabled}, screen=${screenName}`
      );
      this.send({
        type: "set_mode",
        chat_input_enabled: chatInputEnabled,
        mode: chatInputEnabled ? "chat" : "stream",
        screen: screenName,
      });
    }
  }

  /**
   * Sets the active LLM provider (e.g. "mistral", "freeai") and optional model on the backend.
   */
  setLlmProvider(provider: string, model?: string) {
    this.pendingLlmProvider = { provider, model };
    if (this.lastConfig) {
      this.lastConfig = {
        ...this.lastConfig,
        llm_provider: provider,
        llm_model: model || this.lastConfig.llm_model,
      };
    }
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log(`[AvatarSocket] Sending set_llm_provider: provider=${provider}, model=${model}`);
      this.send({
        type: "set_llm_provider",
        provider,
        model,
      });
    }
  }

  /**
   * Sets whether Tool Calling is enabled on the backend.
   */
  setToolCalling(enabled: boolean, maxCalls?: number) {
    const finalMaxCalls = maxCalls ?? this.pendingToolCalling?.maxCalls ?? 20;
    this.pendingToolCalling = { enabled, maxCalls: finalMaxCalls };
    if (this.lastConfig) {
      this.lastConfig = {
        ...this.lastConfig,
        tool_calling_enabled: enabled,
        max_tool_calls: finalMaxCalls,
      };
    }
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log(`[AvatarSocket] Sending set_tool_calling: enabled=${enabled}, maxCalls=${finalMaxCalls}`);
      this.send({
        type: "set_tool_calling",
        enabled,
        max_calls: finalMaxCalls,
      });
    }
  }

  /**
   * Updates an API key on the backend (e.g. "mistral", "fish", "tavily").
   */
  setApiKey(provider: string, apiKey: string, baseUrl?: string) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log(`[AvatarSocket] Sending set_api_key: provider=${provider}`);
      this.send({
        type: "set_api_key",
        provider,
        api_key: apiKey,
        base_url: baseUrl,
      });
    }
  }

  /**
   * Sets the llama.cpp server URL on the backend.
   */
  setLlamacppUrl(baseUrl: string) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.send({
        type: "set_api_key",
        provider: "llama_cpp",
        api_key: "",
        base_url: baseUrl,
      });
    }
  }

  /**
   * Requests the latest config payload from the backend server.
   */
  requestConfig() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.send({ type: "get_config" });
    }
  }

  /**
   * Returns the most recently received config event from the backend.
   */
  getLastConfig(): ConfigEvent | null {
    return this.lastConfig;
  }

  connect() {
    if (
      this.socket &&
      (
        this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING
      )
    ) {
      return;
    }

    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.manuallyClosed = false;

    console.log("[AvatarSocket] Connecting...");
    this.notifyStatus("connecting");

    this.socket = new WebSocket(WS_URL);
    this.socket.binaryType = "arraybuffer";

    this.socket.onopen = () => {
      console.log("[AvatarSocket] Connected");
      this.notifyStatus("connected");
      audioPlayer.resume().catch(() => {});
      // Synchronize active mode with server immediately upon connection
      this.setMode(this.currentMode.chat_input_enabled, this.currentMode.screen);
      // Synchronize active LLM provider & model with server immediately upon connection
      if (this.pendingLlmProvider) {
        this.setLlmProvider(this.pendingLlmProvider.provider, this.pendingLlmProvider.model);
      }
      // Synchronize tool calling state with server
      if (this.pendingToolCalling) {
        this.setToolCalling(this.pendingToolCalling.enabled, this.pendingToolCalling.maxCalls);
      }
      // Synchronize stored API keys with server
      if (typeof window !== "undefined") {
        const storedMistralKey = localStorage.getItem("koko_mistral_api_key");
        if (storedMistralKey) {
          this.setApiKey("mistral", storedMistralKey);
        }
      }
      this.requestConfig();
    };


    this.socket.onmessage = (message) => {
      // -----------------------------------------------------------------------
      // Binary path — audio packets
      // -----------------------------------------------------------------------
      if (message.data instanceof ArrayBuffer) {
        const packet = new Uint8Array(message.data);
        const type = packet[0];

        switch (type) {
          case PACKET_AUDIO_CHUNK: {
            const audioBytes = packet.slice(1).buffer;
            subtitleSync.addBytes(audioBytes.byteLength);
            audioQueue.push(audioBytes);
            console.log(
              `[Audio] chunk ${packet.length - 1}B | end=${audioPlayer.scheduledEndTime.toFixed(3)}s`,
            );
            break;
          }

          case PACKET_AUDIO_END: {
            subtitleSync.markAudioEnd();
            console.log(
              `[Audio] stream end | totalDuration=${subtitleSync.totalDuration.toFixed(3)}s`,
            );
            break;
          }

          case PACKET_AUDIO_INTERRUPT: {
            console.log("[Audio] interrupt");
            speechQueue.interrupt();
            subtitleSync.reset();
            audioQueue.flush();
            break;
          }

          default:
            console.warn("[AvatarSocket] Unknown binary packet type:", type);
        }

        return;
      }

      // -----------------------------------------------------------------------
      // JSON path — avatar events
      // -----------------------------------------------------------------------
      try {
        const event = JSON.parse(message.data as string) as AvatarEvent;

        console.log("[AvatarSocket]", event.type, event);

        if (event.type === "config") {
          this.lastConfig = event as ConfigEvent;
        } else if (event.type === "speech_segment") {
          speechQueue.enqueue(event as SpeechSegmentEvent);
        } else if (event.type === "turn_end") {
          speechQueue.endTurn();
        } else if ((event as any).type === "interrupt") {
          speechQueue.interrupt();
        }

        avatarEvents.emit(event);
      } catch (err) {
        console.error("[AvatarSocket] Invalid packet", err);
      }
    };

    this.socket.onerror = (err) => {
      console.error("[AvatarSocket] Socket error", err);
      this.notifyStatus("disconnected");
    };

    this.socket.onclose = () => {
      console.warn("[AvatarSocket] Disconnected");
      this.socket = null;
      this.notifyStatus("disconnected");
      if (!this.manuallyClosed) {
        this.scheduleReconnect();
      }
    };
  }

  disconnect() {
    this.manuallyClosed = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
    }
    this.socket?.close();
    this.notifyStatus("disconnected");
  }

  send(data: unknown) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn("[AvatarSocket] Send failed: socket not open (readyState:", this.socket?.readyState, ")");
      return;
    }
    console.log("[AvatarSocket] Sent:", data);
    this.socket.send(JSON.stringify(data));
  }

  sendBinary(data: ArrayBuffer) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    this.socket.send(data);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer !== null) return;

    console.log("[AvatarSocket] Reconnecting in 2 seconds...");

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }

  get connected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}

export const avatarSocket = new AvatarSocket();