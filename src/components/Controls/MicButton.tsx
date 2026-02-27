/**
 * MicButton – Primary voice input control
 * 
 * Design:
 *  • White background circle (bg-white/10, hover: bg-white/20)
 *  • Large white mic icon (w-8 h-8)
 *  • Scale up on hover (scale-110)
 *  • Pulse rings when listening
 */

import { memo } from "react";
import { MicIcon } from "../UI/icons";

interface MicButtonProps {
  isListening: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export const MicButton = memo(function MicButton({
  isListening,
  onClick,
  disabled,
}: MicButtonProps) {
  return (
    <div className="relative flex items-center justify-center">
      {/* Subtle pulse ring when listening */}
      {isListening && (
        <span
          className="absolute h-20 w-20 animate-pulse-ring rounded-full bg-speak/30"
        />
      )}

      {/* Main button */}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={isListening ? "Stop listening" : "Start listening"}
        className={`
          relative z-10 flex h-16 w-16 items-center justify-center
          rounded-full
          transition-all duration-200 ease-out
          focus-visible:outline-none focus-visible:ring-2
          focus-visible:ring-accent focus-visible:ring-offset-2
          disabled:pointer-events-none disabled:opacity-40
          ${isListening
            ? "bg-speak text-white scale-110"
            : "bg-white text-surface-700 hover:bg-surface-50 border border-surface-200 dark:bg-surface-800 dark:text-white dark:border-surface-700 dark:hover:bg-surface-700 hover:scale-105 active:scale-95"
          }
        `}
        style={{ touchAction: "manipulation" }}
      >
        <MicIcon
          size={28}
          className="transition-transform duration-200"
        />
      </button>
    </div>
  );
});
