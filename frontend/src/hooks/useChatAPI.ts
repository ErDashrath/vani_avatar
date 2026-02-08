/**
 * useChatAPI – Async LLM communication hook.
 *
 * skills.sh applied:
 *  • async-parallel → no waterfalls, single await
 *  • rerender-functional-setstate → safe concurrent updates
 *  • js-early-exit → guard returns on empty input
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { API, LLM } from "../utils/constants";
import type { ChatMessage, ChatResponse } from "../types";

interface UseChatAPIReturn {
  isLoading: boolean;
  error: string | null;
  sendMessage: (
    message: string,
    history: ChatMessage[],
  ) => Promise<string>;
  sendMessageStream: (
    message: string,
    history: ChatMessage[],
    onChunk: (text: string) => void,
  ) => Promise<string>;
  abort: () => void;
}

export function useChatAPI(): UseChatAPIReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  /** Cancel any in-flight request. */
  const abort = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setIsLoading(false);
  }, []);

  /** Non-streaming: single JSON response. */
  const sendMessage = useCallback(
    async (message: string, history: ChatMessage[]): Promise<string> => {
      if (!message.trim()) return "";
      abort();

      const ac = new AbortController();
      controllerRef.current = ac;
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(API.CHAT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            history,
            max_tokens: LLM.MAX_TOKENS,
            temperature: LLM.TEMPERATURE,
          }),
          signal: ac.signal,
        });

        if (!res.ok) throw new Error(`API ${res.status}`);

        const data: ChatResponse = await res.json();
        return data.response;
      } catch (err) {
        if ((err as Error).name === "AbortError") return "";
        const msg = (err as Error).message ?? "Unknown error";
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [abort],
  );

  /** Streaming: SSE chunks piped to callback. */
  const sendMessageStream = useCallback(
    async (
      message: string,
      history: ChatMessage[],
      onChunk: (text: string) => void,
    ): Promise<string> => {
      if (!message.trim()) return "";
      abort();

      const ac = new AbortController();
      controllerRef.current = ac;
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(API.CHAT_STREAM, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            history,
            max_tokens: LLM.MAX_TOKENS,
            temperature: LLM.TEMPERATURE,
          }),
          signal: ac.signal,
        });

        if (!res.ok) throw new Error(`API ${res.status}`);

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let full = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          for (const line of text.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            if (data.startsWith("[ERROR]")) {
              throw new Error(data.slice(8).trim() || "Server streaming error");
            }
            full += data;
            onChunk(full);
          }
        }

        return full || "I understand. Can you tell me more?";
      } catch (err) {
        if ((err as Error).name === "AbortError") return "";
        const msg = (err as Error).message ?? "Unknown error";
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [abort],
  );

  // Cleanup on unmount: abort any in-flight request.
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  return { isLoading, error, sendMessage, sendMessageStream, abort };
}
