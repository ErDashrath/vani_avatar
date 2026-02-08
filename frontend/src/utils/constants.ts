/* ─── Application-wide constants ─────────────────────────────── */

/** API configuration from environment variables. */
const API_BASE_URL = import.meta.env.VITE_API_URL || "";

/** Backend base paths (proxied by Vite in dev). */
export const API = {
  BASE_URL: API_BASE_URL,
  CHAT: `${API_BASE_URL}/api/chat`,
  CHAT_STREAM: `${API_BASE_URL}/api/chat/stream`,
  HEALTH: `${API_BASE_URL}/api/health`,
} as const;

/** LLM defaults sent with every request. */
export const LLM = {
  MAX_TOKENS: 150,
  TEMPERATURE: 0.7,
} as const;

/** Animation timing (ms / fps). */
export const ANIM = {
  TARGET_FPS: 60,
  FRAME_MS: 1000 / 60,
  MOUTH_SMOOTH: 0.15,        // lerp factor for mouth close
  BLINK_MIN_MS: 2_000,
  BLINK_MAX_MS: 6_000,
  BLINK_DURATION_MS: 150,
} as const;

/** Canvas avatar sizing – realistic human face. */
export const AVATAR = {
  /** Canvas pixel dimensions (high-res for detail). */
  SIZE: 320,
  /** Display size in CSS pixels. */
  DISPLAY_SIZE: 280,
} as const;

/** Unique ID helper. */
let _seq = 0;
export const uid = (): string => `${Date.now()}-${++_seq}`;
