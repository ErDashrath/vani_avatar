/* ─── Shared TypeScript types ────────────────────────────────── */

/** A single chat message (matches backend schema). */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Payload sent to POST /api/chat */
export interface ChatRequest {
  message: string;
  history: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
}

/** Response from POST /api/chat */
export interface ChatResponse {
  response: string;
  model: string;
  tokens_used: number;
}

/** Visual status of the avatar system. */
export type AppStatus = "ready" | "listening" | "thinking" | "speaking" | "error";

/** Avatar rendering mode. */
export type AvatarType = "realistic" | "cartoon3d" | "photo" | "gif";

/** Stored conversation entry for the UI list. */
export interface ConversationEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

/** Voice configuration for TTS. */
export interface VoiceConfig {
  voice: SpeechSynthesisVoice | null;
  rate: number;
  pitch: number;
}

/** Extend Window for webkit SpeechRecognition prefix. */
declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
