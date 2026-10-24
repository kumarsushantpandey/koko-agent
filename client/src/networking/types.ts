export interface ToolSummary {
  name: string;
  description: string;
  parameters: Record<string, any>;
  aliases?: string[];
}

export interface ModelOption {
  id: string;
  name: string;
  context?: string;
  tools?: boolean;
  vision?: boolean;
}

export interface ProviderOption {
  id: string;
  name: string;
  base_url?: string;
  models: ModelOption[];
}

export interface ConfigEvent {
  type: "config";
  assistant_name: string;
  chat_input_enabled: boolean;
  llm_provider: string;
  llm_model: string;
  available_llm_providers: ProviderOption[];
  tool_calling_enabled: boolean;
  tool_calling_supported: boolean;
  vision_supported: boolean;
  max_tool_calls: number;
  available_tools: ToolSummary[];
  api_keys_configured: {
    mistral: boolean;
    llama_cpp: boolean;
    tavily: boolean;
    fish: boolean;
  };
}

export interface SpeechSegmentEvent {
  type: "speech_segment";
  text: string;
  raw_text?: string;
  audio: string; // base64 WAV Data URI
  emotion?: string;
  segment_index: number;
  is_last: boolean;
}

export interface TranscriptEvent {
  type: "transcript";
  text: string;
  is_final?: boolean;
}

export interface ToolTelemetryEvent {
  type: "tool_start" | "tool_end";
  tool_name: string;
}

export type AvatarSocketEvent =
  | ConfigEvent
  | SpeechSegmentEvent
  | TranscriptEvent
  | ToolTelemetryEvent
  | { type: "thinking_start" }
  | { type: "thinking_end" }
  | { type: "speech_start" }
  | { type: "speech_end" }
  | { type: "turn_end" }
  | { type: "history_cleared" };
