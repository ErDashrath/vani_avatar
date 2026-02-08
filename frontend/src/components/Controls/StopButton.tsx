/**
 * StopButton – sends the accumulated transcript to the LLM.
 *
 * Web Guidelines:
 *  • Specific label: "Stop & Send" not "Submit"
 *  • aria-label
 *  • focus-visible
 */

interface StopButtonProps {
  onClick: () => void;
  visible: boolean;
}

export function StopButton({ onClick, visible }: StopButtonProps) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Stop recording and send message"
      className="
        animate-fade-in rounded-xl bg-danger px-6 py-4
        text-base font-semibold text-white
        transition-transform duration-200
        hover:brightness-110 active:scale-[.96]
        focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-danger focus-visible:ring-offset-2
        focus-visible:ring-offset-surface-950
      "
      style={{ touchAction: "manipulation" }}
    >
      <span aria-hidden="true">⏹️</span> Stop &amp; Send
    </button>
  );
}
