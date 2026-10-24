import { avatarEvents } from "./EventBus";
import { speechQueue } from "../audio/SpeechQueue";
import type { AvatarSocketEvent, ConfigEvent } from "./types";

export class AvatarSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectTimer: any = null;
  private isIntentionalClose = false;
  private latestConfig: ConfigEvent | null = null;

  constructor(url: string = "ws://127.0.0.1:8765") {
    this.url = url;
  }

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isIntentionalClose = false;
    avatarEvents.emit("status", "connecting");

    try {
      this.ws = new WebSocket(this.url);
      this.ws.binaryType = "arraybuffer";

      this.ws.onopen = () => {
        avatarEvents.emit("status", "connected");
        // Request latest config immediately
        this.sendJson({ type: "get_config" });
      };

      this.ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          try {
            const data: AvatarSocketEvent = jsonParseSafe(event.data);
            if (!data) return;

            if (data.type === "config") {
              this.latestConfig = data;
              avatarEvents.emit("config", data);
            } else if (data.type === "speech_segment") {
              speechQueue.enqueue({
                audio: data.audio,
                text: data.text,
                emotion: data.emotion,
                segment_index: data.segment_index,
              });
              avatarEvents.emit("speech_segment", data);
            } else if (data.type === "transcript") {
              avatarEvents.emit("transcript", data);
            } else if (data.type === "tool_start" || data.type === "tool_end") {
              avatarEvents.emit(data.type, data);
            } else {
              avatarEvents.emit(data.type, data);
            }
          } catch (err) {
            console.warn("Failed to parse incoming JSON event:", err);
          }
        }
      };

      this.ws.onclose = () => {
        avatarEvents.emit("status", "disconnected");
        if (!this.isIntentionalClose) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn("WebSocket error:", err);
      };
    } catch (e) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }

  sendJson(obj: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  sendChatMessage(
    text: string,
    image?: string,
    provider?: string,
    model?: string,
    toolsEnabled?: boolean
  ): void {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.sendJson({
      type: "chat_message",
      text,
      image,
      provider,
      model,
      tools_enabled: toolsEnabled ?? true,
      timezone: tz,
    });
  }

  sendVoiceChunk(pcmInt16Bytes: Uint8Array): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Header 0x10 = VOICE_CHUNK
      const packet = new Uint8Array(1 + pcmInt16Bytes.length);
      packet[0] = 0x10;
      packet.set(pcmInt16Bytes, 1);
      this.ws.send(packet.buffer);
    }
  }

  sendVoiceEnd(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Header 0x11 = VOICE_END
      const packet = new Uint8Array([0x11]);
      this.ws.send(packet.buffer);
    }
  }

  interrupt(): void {
    speechQueue.clear();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Header 0x03 = AUDIO_INTERRUPT
      const packet = new Uint8Array([0x03]);
      this.ws.send(packet.buffer);
      this.sendJson({ type: "interrupt" });
    }
  }

  setLlmProvider(provider: string, model?: string): void {
    this.sendJson({
      type: "set_llm_provider",
      provider,
      model,
    });
  }

  setToolCalling(enabled: boolean): void {
    this.sendJson({
      type: "set_tool_calling",
      enabled,
    });
  }

  setApiKey(provider: string, apiKey?: string, baseUrl?: string): void {
    this.sendJson({
      type: "set_api_key",
      provider,
      api_key: apiKey,
      base_url: baseUrl,
    });
  }

  clearHistory(): void {
    this.sendJson({ type: "clear_history" });
  }

  getConfig(): ConfigEvent | null {
    return this.latestConfig;
  }
}

function jsonParseSafe(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

export const avatarSocket = new AvatarSocket();
