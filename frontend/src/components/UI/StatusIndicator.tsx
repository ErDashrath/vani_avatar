/**
 * StatusIndicator – shows current app state beneath the avatar.
 *
 * Web Guidelines applied:
 *  • aria-live="polite" for async status updates
 *  • animate transform/opacity only
 */

import { useChatStore } from "../../store/chatStore";

const LABELS: Record<string, { text: string; color: string }> = {
  ready:     { text: "Ready",          color: "bg-emerald-400" },
  listening: { text: "Listening…",     color: "bg-speak" },
  thinking:  { text: "Thinking…",      color: "bg-accent" },
  speaking:  { text: "Speaking…",      color: "bg-accent-light" },
  error:     { text: "Error",          color: "bg-danger" },
};

export function StatusIndicator() {
  const status = useChatStore((s) => s.status);
  const { text, color } = LABELS[status] ?? LABELS.ready;

  return (
    <div
      aria-live="polite"
      className="
        mt-3 flex items-center gap-2 rounded-full
        bg-surface-800/80 px-4 py-1.5 text-xs font-medium
        tracking-wide text-surface-200 shadow-md backdrop-blur
        animate-fade-in
      "
    >
      <span
        className={`
          inline-block h-2 w-2 rounded-full ${color}
          ${status !== "ready" ? "animate-pulse-ring" : ""}
        `}
      />
      {text}
    </div>
  );
}
