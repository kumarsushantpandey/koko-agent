import React, { useState, useRef, useEffect } from "react";
import {
  IconSend,
  IconMicrophone,
  IconMicrophoneOff,
  IconCamera,
  IconSquare,
  IconX,
} from "@tabler/icons-react";
import { processImageFile, type ProcessedImage } from "../utils/imageUtils";
import { avatarSocket } from "../networking/AvatarSocket";
import { avatarEvents } from "../networking/EventBus";

interface ChatInputProps {
  placeholder?: string;
  provider?: string;
  model?: string;
  toolsEnabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  placeholder = "Chat with Koko AI...",
  provider,
  model,
  toolsEnabled = true,
}) => {
  const [text, setText] = useState("");
  const [attachedImage, setAttachedImage] = useState<ProcessedImage | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [interimText, setInterimText] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  useEffect(() => {
    const unsubTranscript = avatarEvents.on("transcript", (data) => {
      if (data?.text) {
        if (!data.is_final) {
          setInterimText(data.text);
        } else {
          setInterimText("");
        }
      }
    });

    const unsubThinking = avatarEvents.on("thinking_start", () => setIsGenerating(true));
    const unsubSpeechStart = avatarEvents.on("speech_start", () => setIsGenerating(true));
    const unsubTurnEnd = avatarEvents.on("turn_end", () => setIsGenerating(false));

    return () => {
      unsubTranscript();
      unsubThinking();
      unsubSpeechStart();
      unsubTurnEnd();
    };
  }, []);

  const handleSend = () => {
    const clean = text.trim();
    if (!clean && !attachedImage) return;

    avatarSocket.sendChatMessage(
      clean,
      attachedImage?.dataUri,
      provider,
      model,
      toolsEnabled
    );

    setText("");
    setAttachedImage(null);
    setInterimText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStop = () => {
    avatarSocket.interrupt();
    setIsGenerating(false);
  };

  // Image Upload Handling
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      try {
        const processed = await processImageFile(file);
        setAttachedImage(processed);
      } catch (err) {
        console.error("Failed to process image:", err);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Clipboard Paste Support (Ctrl+V screenshots)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          try {
            const processed = await processImageFile(file);
            setAttachedImage(processed);
          } catch (err) {
            console.error("Paste image compression error:", err);
          }
        }
        break;
      }
    }
  };

  // Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      try {
        const processed = await processImageFile(file);
        setAttachedImage(processed);
      } catch (err) {
        console.error("Drop image compression error:", err);
      }
    }
  };

  // 16kHz Int16 PCM Microphone Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000 },
      });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      // 4096 samples = ~256ms chunk
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16 PCM
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        avatarSocket.sendVoiceChunk(new Uint8Array(pcm16.buffer));
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      setIsRecording(true);
      setInterimText("");
    } catch (err) {
      console.error("Could not start microphone:", err);
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    setIsRecording(false);

    avatarSocket.sendVoiceEnd();

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  return (
    <div
      className={`chat-input-wrapper ${isDragging ? "dragging" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Live Interim Whisper Transcription Banner */}
      {interimText && (
        <div className="interim-bubble glass-panel animate-fade-in">
          <span className="interim-dot animate-pulse" />
          <span className="interim-text">{interimText}</span>
        </div>
      )}

      {/* Image Preview Thumbnail Chip */}
      {attachedImage && (
        <div className="image-preview-chip glass-panel">
          <img src={attachedImage.dataUri} alt="Preview" className="preview-thumbnail" />
          <div className="preview-meta">
            <span className="preview-name">{attachedImage.name}</span>
            <span className="preview-size">{(attachedImage.sizeBytes / 1024).toFixed(1)} KB</span>
          </div>
          <button
            type="button"
            className="chip-dismiss-btn"
            onClick={() => setAttachedImage(null)}
            title="Remove attachment"
          >
            <IconX size={16} />
          </button>
        </div>
      )}

      <div className="chat-input-bar glass-panel">
        {/* Hidden Camera Input */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <button
          type="button"
          className="chat-action-btn camera-btn"
          title="Attach image or photo"
          onClick={() => fileInputRef.current?.click()}
        >
          <IconCamera size={20} />
        </button>

        <input
          type="text"
          className="chat-text-input"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
        />

        {/* Microphone Button */}
        <button
          type="button"
          className={`chat-action-btn mic-btn ${isRecording ? "recording" : ""}`}
          title={isRecording ? "Release to send voice" : "Press to speak"}
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
        >
          {isRecording ? <IconMicrophoneOff size={20} /> : <IconMicrophone size={20} />}
        </button>

        {/* Stop or Send Action Button */}
        {isGenerating ? (
          <button
            type="button"
            className="chat-action-btn stop-btn"
            title="Stop speaking"
            onClick={handleStop}
          >
            <IconSquare size={20} />
          </button>
        ) : (
          <button
            type="button"
            className="chat-action-btn send-btn"
            title="Send message"
            onClick={handleSend}
            disabled={!text.trim() && !attachedImage}
          >
            <IconSend size={20} />
          </button>
        )}
      </div>
    </div>
  );
};
