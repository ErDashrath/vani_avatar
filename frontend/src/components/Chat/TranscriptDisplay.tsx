/**
 * Real-time interim transcript display (while user is speaking).
 */

interface TranscriptDisplayProps {
  text: string;
}

export function TranscriptDisplay({ text }: TranscriptDisplayProps) {
  return (
    <div className="mb-2 flex animate-fade-in justify-end">
      <p
        className="
          inline-block max-w-[80%] break-words rounded-2xl
          bg-speak/20 px-4 py-3 text-sm italic
          text-speak-light shadow
        "
      >
        {text}
      </p>
    </div>
  );
}
