/**
 * Single message bubble.
 *
 * Web Guidelines:
 *  • word-break for long user-generated content
 *  • slide-up animation
 */

import type { ConversationEntry } from "../../types";

interface MessageProps {
  entry: ConversationEntry;
}

export function Message({ entry }: MessageProps) {
  const isUser = entry.role === "user";

  return (
    <div
      className={`mb-2 flex animate-slide-up ${isUser ? "justify-end" : "justify-start"}`}
    >
      <p
        className={`
          inline-block max-w-[80%] break-words rounded-2xl px-4 py-3
          text-sm leading-relaxed shadow
          ${
            isUser
              ? "bg-accent text-surface-950 font-medium"
              : "bg-surface-800 text-surface-100"
          }
        `}
      >
        {entry.content}
      </p>
    </div>
  );
}
