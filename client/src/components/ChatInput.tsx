/**
 * ChatInput
 *
 * Glassmorphic floating chat bar for Akari Watanabe.
 *
 * Voice recording:
 *   - Captures raw 16kHz mono PCM via AudioContext
 *   - Streams int16 binary chunks over WebSocket (packet type 0x10)
 *   - Server runs single-model Whisper (tiny.en) every ~0.5s for real-time live streaming
 *   - Words stream in live word-by-word and append to chat without rewriting
 *
 * Text input:
 *   - Instant zero-latency typing with rAF-debounced sizing and GPU-isolated backdrop
 *   - Enter key sends message immediately; Shift+Enter adds newline
 *   - Native key event isolation stops propagation to window/canvas listeners
 *   - Direct DOM button updating for zero-latency visual feedback
 */

import { useState, useRef, useCallback, useEffect } from "react";
import {
  IconMicrophone,
  IconPlayerStopFilled,
  IconArrowUp,
  IconCamera,
  IconX,
  IconLoader2,
} from "@tabler/icons-react";
import { avatarSocket } from "../networking";
import { avatarEvents } from "../networking/EventBus";
import { speechQueue } from "../audio/SpeechQueue";
import { processImageFile, type ProcessedImage } from "../utils/imageUtils";
import { getCharacterConfig } from "./character";
import "./ChatInput.css";

const MAX_ROWS = 6;
const LINE_HEIGHT = 22;
const PADDING_Y = 20;

const PACKET_VOICE_CHUNK = 0x10;
const PACKET_VOICE_END = 0x11;
const TARGET_SAMPLE_RATE = 16000;

interface ChatInputProps {
  character?: string;
}

export default function ChatInput({ character = "koko" }: ChatInputProps) {
  const characterConfig = getCharacterConfig(character);
  const [canSend, setCanSend] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isResponding, setIsResponding] = useState(false);

  // Image attachment state
  const [attachedImage, setAttachedImage] = useState<ProcessedImage | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendBtnRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isRespondingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const attachedImageRef = useRef<ProcessedImage | null>(null);
  const resizePendingRef = useRef(false);

  // Audio recording refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    attachedImageRef.current = attachedImage;
    if (!isRespondingRef.current) {
      const hasText = (textareaRef.current?.value.trim().length ?? 0) > 0;
      const canSubmit = hasText || attachedImage !== null;
      if (sendBtnRef.current) sendBtnRef.current.disabled = !canSubmit;
      setCanSend(canSubmit);
    }
  }, [attachedImage]);

  // Keep refs updated for fast access
  useEffect(() => {
    isRespondingRef.current = isResponding;
    if (isResponding) {
      if (sendBtnRef.current) sendBtnRef.current.disabled = false;
      setCanSend(false);
    } else {
      const hasText = (textareaRef.current?.value.trim().length ?? 0) > 0;
      const canSubmit = hasText || attachedImageRef.current !== null;
      if (sendBtnRef.current) sendBtnRef.current.disabled = !canSubmit;
      setCanSend(canSubmit);
    }
  }, [isResponding]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // ─── Auto-resize textarea via requestAnimationFrame (0ms input latency) ───
  const scheduleResize = useCallback(() => {
    // If native CSS field-sizing is supported, browser handles it automatically with 0ms JS cost
    if (typeof CSS !== "undefined" && CSS.supports && CSS.supports("field-sizing", "content")) {
      return;
    }
    if (resizePendingRef.current) return;
    resizePendingRef.current = true;

    requestAnimationFrame(() => {
      resizePendingRef.current = false;
      const el = textareaRef.current;
      if (!el) return;

      el.style.height = "auto";
      const maxH = LINE_HEIGHT * MAX_ROWS + PADDING_Y;
      el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
    });
  }, []);

  // ─── Send raw binary voice chunk over WebSocket ────────────────────────
  const sendVoiceChunk = useCallback((int16Array: Int16Array) => {
    const packet = new Uint8Array(1 + int16Array.byteLength);
    packet[0] = PACKET_VOICE_CHUNK;
    packet.set(new Uint8Array(int16Array.buffer), 1);
    avatarSocket.sendBinary(packet.buffer);
  }, []);

  const sendVoiceEnd = useCallback(() => {
    avatarSocket.sendBinary(new Uint8Array([PACKET_VOICE_END]).buffer);
  }, []);

  // ─── Stop voice recording ──────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    audioContextRef.current?.close().catch(() => { });
    streamRef.current?.getTracks().forEach((t) => t.stop());

    processorRef.current = null;
    sourceRef.current = null;
    audioContextRef.current = null;
    streamRef.current = null;

    sendVoiceEnd();
    setIsRecording(false);
  }, [sendVoiceEnd]);

  // ─── Start voice recording ─────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: TARGET_SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const ctx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
      const source = ctx.createMediaStreamSource(stream);

      const bufferSize = 4096;
      const processor = ctx.createScriptProcessor(bufferSize, 1, 1);

      processor.onaudioprocess = (e) => {
        const float32 = e.inputBuffer.getChannelData(0);

        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        sendVoiceChunk(int16);
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      audioContextRef.current = ctx;
      sourceRef.current = source;
      processorRef.current = processor;
      streamRef.current = stream;

      setIsRecording(true);
    } catch (err) {
      console.error("[ChatInput] Mic access error:", err);
    }
  }, [sendVoiceChunk]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const [activeTool, setActiveTool] = useState<string | null>(null);

  // ─── Image attachment handlers ──────────────────────────────────────────
  const triggerFileInput = useCallback(() => {
    if (isRespondingRef.current || isCompressing) return;
    fileInputRef.current?.click();
  }, [isCompressing]);

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        setIsCompressing(true);
        const processed = await processImageFile(file);
        setAttachedImage(processed);
      } catch (err) {
        console.error("[ChatInput] Image load error:", err);
      } finally {
        setIsCompressing(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        textareaRef.current?.focus();
      }
    },
    [],
  );

  const handleRemoveImage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setAttachedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    textareaRef.current?.focus();
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isRespondingRef.current) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isRespondingRef.current) return;

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      try {
        setIsCompressing(true);
        const processed = await processImageFile(file);
        setAttachedImage(processed);
        textareaRef.current?.focus();
      } catch (err) {
        console.error("[ChatInput] Drag-drop image error:", err);
      } finally {
        setIsCompressing(false);
      }
    }
  }, []);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    if (isRespondingRef.current) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          try {
            setIsCompressing(true);
            const processed = await processImageFile(file, "Pasted_image.png");
            setAttachedImage(processed);
            textareaRef.current?.focus();
          } catch (err) {
            console.error("[ChatInput] Clipboard paste image error:", err);
          } finally {
            setIsCompressing(false);
          }
        }
        break;
      }
    }
  }, []);

  // ─── Send chat message ─────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const el = textareaRef.current;
    if (!el || isRespondingRef.current) return;

    // If recording is active when user sends, stop it immediately
    if (isRecordingRef.current) {
      stopRecording();
    }

    const trimmed = el.value.trim();
    const currentAttached = attachedImageRef.current;
    if (!trimmed && !currentAttached) return;

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

    const toolsStored = localStorage.getItem("koko_tool_calling_enabled") || localStorage.getItem("akari_tool_calling_enabled");
    const toolsEnabled = toolsStored !== null ? toolsStored === "true" : true;

    const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const messageText = trimmed || (currentAttached ? "Look at this image. What do you think?" : "");
    const messageImage = currentAttached?.dataUri;

    const attachments = currentAttached
      ? [
          {
            type: "image" as const,
            mime_type: "image/jpeg",
            data: currentAttached.dataUri,
            name: currentAttached.fileName,
            width: currentAttached.width,
            height: currentAttached.height,
            size_bytes: currentAttached.sizeBytes,
          },
        ]
      : [];

    console.log(
      `[ChatInput] Sending message: "${messageText}" (attachments=${attachments.length}, provider=${provider}, model=${model}, tools_enabled=${toolsEnabled}, tz=${clientTimezone})`
    );

    // Immediately start speech turn to keep the stop icon active throughout thinking, streaming, and audio
    speechQueue.startTurn();

    avatarSocket.send({
      type: "chat_message",
      text: messageText,
      attachments,
      image: messageImage, // backward compatibility
      provider,
      model,
      tools_enabled: toolsEnabled,
      timezone: clientTimezone,
    });

    el.value = "";
    el.style.height = "auto";
    setAttachedImage(null);
    attachedImageRef.current = null;
    setIsResponding(true);
    isRespondingRef.current = true;
    setCanSend(false);
    if (sendBtnRef.current) {
      sendBtnRef.current.disabled = false;
    }
  }, [stopRecording]);

  // ─── Stop AI response ──────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    console.log("[ChatInput] Stopping response & stream...");
    setActiveTool(null);
    speechQueue.interrupt();
    avatarSocket.send({ type: "interrupt" });
    avatarSocket.sendBinary(new Uint8Array([3]).buffer);
    setIsResponding(false);
    isRespondingRef.current = false;

    const has = (textareaRef.current?.value.trim().length ?? 0) > 0 || attachedImageRef.current !== null;
    setCanSend(has);
    if (sendBtnRef.current) {
      sendBtnRef.current.disabled = !has;
    }
    textareaRef.current?.focus();
  }, []);

  // ─── Input handler ──────────────────────────────────────────────────────
  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;

    const has = el.value.trim().length > 0 || attachedImageRef.current !== null;

    // Never modify button disabled state while AI response is active
    if (!isRespondingRef.current) {
      if (sendBtnRef.current && sendBtnRef.current.disabled !== !has) {
        sendBtnRef.current.disabled = !has;
      }
      setCanSend((prev) => (prev !== has ? has : prev));
    }

    scheduleResize();
  }, [scheduleResize]);

  // ─── Key down handler: Enter to send, Shift+Enter for newline ─────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Isolate key events from leaking to canvas / window listeners
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!isRespondingRef.current) {
          handleSend();
        }
      }
    },
    [handleSend]
  );

  const handleKeyUp = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  }, []);

  // ─── Listen for live word-by-word transcription events from server ───────
  useEffect(() => {
    const unsub = avatarEvents.subscribe("transcription" as any, (event: any) => {
      const el = textareaRef.current;
      if (!el) return;

      const word = typeof event.text === "string" ? event.text.trim() : "";
      if (word) {
        if (el.value.length > 0 && !el.value.endsWith(" ") && !el.value.endsWith("\n")) {
          el.value += " " + word;
        } else {
          el.value += word;
        }

        if (!isRespondingRef.current) {
          const nextCanSend = el.value.trim().length > 0;
          if (sendBtnRef.current) sendBtnRef.current.disabled = !nextCanSend;
          setCanSend((prev) => (prev !== nextCanSend ? nextCanSend : prev));
        }
        scheduleResize();
      }

      if (event.is_final) {
        el.focus();
        el.selectionStart = el.selectionEnd = el.value.length;
      }
    });
    return unsub;
  }, [scheduleResize]);

  // ─── Track AI responding state ──────────────────────────────────────────
  useEffect(() => {
    // 1. Primary event: when SpeechQueue has physically finished playing all audio segments
    const unsubAllEnd = speechQueue.onAllSegmentsEnd(() => {
      console.log("[ChatInput] SpeechQueue completed all segments -> stopping response icon");
      setIsResponding(false);
    });

    // 2. Active server indicators keep response state on
    const unsubThinking = avatarEvents.subscribe("thinking_start" as any, () => {
      setIsResponding(true);
    });
    const unsubStart = avatarEvents.subscribe("speech_start", () => {
      setIsResponding(true);
    });

    // 3. Fallback: only if speechQueue is completely inactive should a server speech_end event turn off responding
    const unsubEnd = avatarEvents.subscribe("speech_end", () => {
      setActiveTool(null);
      if (!speechQueue.active) {
        console.log("[ChatInput] Inactive speech_end received -> stopping response icon");
        setIsResponding(false);
      } else {
        console.log("[ChatInput] Retaining response icon: SpeechQueue is actively managing turn");
      }
    });

    // 4. Tool activity events
    const unsubToolStart = avatarEvents.subscribe("tool_start" as any, (event: any) => {
      const toolName = event.tool_name || event.tool || "Executing tool...";
      console.log("[ChatInput] Tool started:", toolName);
      setActiveTool(toolName);
      setIsResponding(true);
    });

    const unsubToolEnd = avatarEvents.subscribe("tool_end" as any, (event: any) => {
      console.log("[ChatInput] Tool completed:", event.tool_name || event.tool);
      setActiveTool(null);
    });

    return () => {
      unsubAllEnd();
      unsubThinking();
      unsubStart();
      unsubEnd();
      unsubToolStart();
      unsubToolEnd();
    };
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        processorRef.current?.disconnect();
        sourceRef.current?.disconnect();
        audioContextRef.current.close().catch(() => { });
        streamRef.current?.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <div className="chat-input-root">
      {activeTool && (
        <div className="chat-tool-activity-indicator" aria-live="polite">
          <span className="tool-indicator-pulse" />
          <span className="tool-indicator-text">
            Checking {activeTool.replace(/^get_/, "").replace(/_/g, " ")}…
          </span>
        </div>
      )}
      <div
        className={`chat-input-bar ${isDragging ? "dragging" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Hidden native file input for camera/image selection */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          style={{ display: "none" }}
          onChange={handleFileInputChange}
        />

        {/* Left Action: Camera / Image attachment */}
        <button
          type="button"
          className={`chat-btn chat-btn-camera ${attachedImage ? "active" : ""}`}
          onClick={triggerFileInput}
          disabled={isResponding || isCompressing}
          title={
            isCompressing
              ? "Compressing image..."
              : attachedImage
              ? "Image attached (click to change)"
              : "Attach image (or drag & drop / paste)"
          }
          aria-label="Attach image"
        >
          {isCompressing ? (
            <IconLoader2 size={18} className="chat-btn-spin" />
          ) : (
            <IconCamera size={19} stroke={1.6} />
          )}
        </button>

        {/* Center / Main Column: Attached preview chip + Textarea */}
        <div className="chat-input-main-column">
          {attachedImage && (
            <div className="chat-image-preview-chip">
              <div className="chat-image-thumb-wrapper">
                <img
                  src={attachedImage.dataUri}
                  alt="Attached preview"
                  className="chat-image-thumb"
                />
                <button
                  type="button"
                  className="chat-image-remove-btn"
                  onClick={handleRemoveImage}
                  title="Remove image"
                  aria-label="Remove image"
                >
                  <IconX size={12} stroke={2.5} />
                </button>
              </div>
              <div className="chat-image-meta">
                <span className="chat-image-name">{attachedImage.fileName || "Image"}</span>
                <span className="chat-image-size">
                  {Math.round(attachedImage.sizeBytes / 1024)} KB · {attachedImage.width}×{attachedImage.height}
                </span>
              </div>
            </div>
          )}

          {/* Textarea — always visible with dynamic placeholder */}
          <textarea
            ref={textareaRef}
            className="chat-input-field"
            placeholder={attachedImage ? `Ask ${characterConfig.displayName} about this image…` : characterConfig.placeholderText}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onPaste={handlePaste}
            rows={1}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>

        {/* Right Actions: Mic → Send */}
        <div className="chat-input-actions">
          <button
            type="button"
            className={`chat-btn chat-btn-mic${isRecording ? " recording" : ""}`}
            onClick={toggleRecording}
            aria-label={isRecording ? "Stop recording" : "Voice input"}
          >
            {isRecording ? (
              <IconPlayerStopFilled size={18} />
            ) : (
              <IconMicrophone size={19} stroke={1.6} />
            )}
          </button>

          <button
            ref={sendBtnRef}
            type="button"
            className={`chat-btn ${isResponding ? "chat-btn-stop" : "chat-btn-send"}`}
            onClick={isResponding ? handleStop : handleSend}
            disabled={!isResponding && !canSend}
            aria-label={isResponding ? "Stop response" : "Send message"}
          >
            {isResponding ? (
              <IconPlayerStopFilled size={14} />
            ) : (
              <IconArrowUp size={18} stroke={2} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
