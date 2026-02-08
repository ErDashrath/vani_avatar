/**
 * ChatContainer – scrollable message list.
 *
 * Web Guidelines applied:
 *  • Semantic list markup with role
 *  • Text overflow handled (break-words, line-clamp)
 *  • Empty state rendered
 *  • scroll-behavior: smooth via Tailwind
 */

import { useEffect, useRef } from "react";
import { useChatStore } from "../../store/chatStore";
import { Message } from "./Message";
import { TranscriptDisplay } from "./TranscriptDisplay";

export function ChatContainer() {
  const messages = useChatStore((s) => s.messages);
  const interimText = useChatStore((s) => s.interimText);
  const status = useChatStore((s) => s.status);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, interimText, status]);

  return (
    <section
      aria-label="Conversation history"
      className="
        mx-auto mb-6 w-full max-w-xl flex-1
        min-h-[200px] max-h-[45vh] overflow-y-auto
        scroll-smooth rounded-2xl
        bg-surface-900/60 p-4 backdrop-blur
      "
    >
      {messages.length === 0 && !interimText && (
        <div className="flex h-full min-h-[160px] items-center justify-center">
          <p className="text-center text-sm text-surface-200/40">
            Tap the mic to start talking&nbsp;🎙️
          </p>
        </div>
      )}

      <div className="space-y-2">
        {messages.map((m) => (
          <Message key={m.id} entry={m} />
        ))}

        {interimText && <TranscriptDisplay text={interimText} />}

        {status === "thinking" && (
          <div className="mb-2 flex animate-fade-in justify-start">
            <div className="inline-flex items-center gap-2 rounded-2xl bg-surface-800 px-4 py-3 text-sm text-surface-200/60 shadow">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-surface-500 border-t-accent" />
              Thinking…
            </div>
          </div>
        )}
      </div>

      <div ref={bottomRef} className="h-1" />
    </section>
  );
}
