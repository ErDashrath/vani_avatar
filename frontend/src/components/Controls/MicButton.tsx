/**
 * MicButton – primary mic toggle.
 *
 * Web Guidelines applied:
 *  • <button> with aria-label (icon-only)
 *  • focus-visible ring
 *  • touch-action: manipulation
 *  • animate only transform/opacity
 */

interface MicButtonProps {
  isListening: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export function MicButton({ isListening, onClick, disabled }: MicButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isListening ? "Stop listening" : "Start listening"}
      className={`
        flex flex-1 items-center justify-center gap-3
        rounded-xl px-6 py-4 text-base font-semibold
        transition-colors transition-transform duration-200
        focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-accent focus-visible:ring-offset-2
        focus-visible:ring-offset-surface-950
        disabled:pointer-events-none disabled:opacity-40
        ${
          isListening
            ? "bg-speak text-surface-950 hover:bg-speak-light active:scale-[.97]"
            : "bg-accent text-surface-950 hover:bg-accent-light active:scale-[.97]"
        }
      `}
      style={{ touchAction: "manipulation" }}
    >
      <span className="text-xl" aria-hidden="true">
        {isListening ? "🔴" : "🎤"}
      </span>
      {isListening ? "Listening… (auto-sends)" : "Tap to Speak"}
    </button>
  );
}
