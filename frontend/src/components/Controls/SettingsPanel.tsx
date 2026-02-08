/**
 * SettingsPanel – voice, speed, and avatar type selectors.
 *
 * Web Guidelines applied:
 *  • <label> wrapping <select> (clickable hit target)
 *  • Explicit background-color + color on <select> for dark-mode compat
 */

import type { AvatarType } from "../../types";
import { useChatStore } from "../../store/chatStore";

interface SettingsPanelProps {
  voices: SpeechSynthesisVoice[];
  selectedVoiceName: string;
  rate: number;
  onVoiceChange: (v: SpeechSynthesisVoice) => void;
  onRateChange: (r: number) => void;
}

const AVATAR_OPTIONS: { value: AvatarType; label: string; desc: string }[] = [
  { value: "realistic", label: "Realistic 2D", desc: "Photorealistic canvas face" },
  { value: "cartoon3d", label: "Cartoon 3D", desc: "Three.js animated character" },
  { value: "photo", label: "Photo Avatar", desc: "Realistic with overlay" },
  { value: "gif", label: "Animated GIF", desc: "Real photo/GIF animation" },
];

export function SettingsPanel({
  voices,
  selectedVoiceName,
  rate,
  onVoiceChange,
  onRateChange,
}: SettingsPanelProps) {
  const avatarType = useChatStore((s) => s.avatarType);
  const setAvatarType = useChatStore((s) => s.setAvatarType);

  return (
    <div className="mx-auto mt-6 grid max-w-xl grid-cols-2 gap-4">
      {/* Avatar Type */}
      <label className="flex flex-col gap-1.5 text-xs font-medium text-surface-200/60">
        🎭 Avatar
        <select
          value={avatarType}
          onChange={(e) => setAvatarType(e.target.value as AvatarType)}
          className="
            rounded-lg border border-surface-700
            bg-surface-800 px-3 py-2 text-sm text-surface-100
            focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-accent
          "
        >
          {AVATAR_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {/* Voice */}
      <label className="flex flex-col gap-1.5 text-xs font-medium text-surface-200/60">
        🗣️ Voice
        <select
          value={selectedVoiceName}
          onChange={(e) => {
            const v = voices.find((x) => x.name === e.target.value);
            if (v) onVoiceChange(v);
          }}
          className="
            rounded-lg border border-surface-700
            bg-surface-800 px-3 py-2 text-sm text-surface-100
            focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-accent
          "
        >
          {voices.length === 0 && (
            <option value="" disabled>
              Loading voices…
            </option>
          )}
          {voices.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </label>

      {/* Speed */}
      <label className="flex flex-col gap-1.5 text-xs font-medium text-surface-200/60 col-span-2">
        ⚡ Speed
        <select
          value={rate}
          onChange={(e) => onRateChange(Number(e.target.value))}
          className="
            rounded-lg border border-surface-700
            bg-surface-800 px-3 py-2 text-sm text-surface-100
            focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-accent
          "
        >
          <option value={0.5}>0.5× Slow</option>
          <option value={0.75}>0.75×</option>
          <option value={1}>1× Normal</option>
          <option value={1.25}>1.25×</option>
          <option value={1.5}>1.5× Fast</option>
        </select>
      </label>
    </div>
  );
}
