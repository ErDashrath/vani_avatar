/**
 * App – root orchestrator.
 *
 * Flow (industry standard voice assistant):
 *  1. User taps "Tap to Speak" → status: listening, mic on
 *  2. User speaks → interim transcript shown in real-time
 *  3. User pauses 1.5s → auto-detected silence → auto-send
 *  4. status: thinking → LLM processes
 *  5. status: speaking → TTS reads reply, avatar animates
 *  6. status: ready → idle, back to step 1
 *
 * No manual "Stop & Send" — it's fully automatic.
 * Escape cancels at any time during thinking/speaking.
 */

import { useCallback, useEffect, useRef, memo } from "react";
import { Avatar } from "./components/Avatar/Avatar";
import { ChatContainer } from "./components/Chat/ChatContainer";
import { MicButton } from "./components/Controls/MicButton";
import { SettingsPanel } from "./components/Controls/SettingsPanel";
import { useVoiceInput } from "./hooks/useVoiceInput";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis";
import { useChatAPI } from "./hooks/useChatAPI";
import { useChatStore } from "./store/chatStore";
import type { ChatMessage } from "./types";

// ── Static header (hoisted – never re-created) ──
const Header = (
  <header className="mb-6 text-center">
    <h1 className="text-3xl font-bold tracking-tight text-accent">
      Voice Avatar
    </h1>
    <p className="mt-1 text-sm text-surface-200/50">
      Tap to speak · I'll listen and respond
    </p>
  </header>
);

const MemoAvatar = memo(Avatar);
const MemoChatContainer = memo(ChatContainer);

export default function App() {
  const tts = useSpeechSynthesis();
  const api = useChatAPI();

  const status = useChatStore((s) => s.status);
  const setStatus = useChatStore((s) => s.setStatus);
  const setInterimText = useChatStore((s) => s.setInterimText);
  const addMessage = useChatStore((s) => s.addMessage);

  // Guard to prevent double-sends.
  const processingRef = useRef(false);

  /* ─── Process & send a finalized transcript to the LLM ─── */
  const processTranscript = useCallback(
    async (text: string) => {
      if (!text || processingRef.current) return;
      processingRef.current = true;

      setInterimText("");
      addMessage("user", text);
      setStatus("thinking");

      const latestMessages = useChatStore.getState().messages;
      const history: ChatMessage[] = latestMessages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const reply = await api.sendMessage(text, history);
        if (!reply) {
          processingRef.current = false;
          return;
        }
        addMessage("assistant", reply);
        setStatus("speaking");
        await tts.speak(reply);
        setStatus("ready");
      } catch {
        if (useChatStore.getState().status !== "ready") {
          setStatus("error");
          addMessage("assistant", "Sorry, something went wrong. Please try again.");
          setTimeout(() => setStatus("ready"), 2000);
        }
      } finally {
        processingRef.current = false;
      }
    },
    [api, tts, addMessage, setStatus, setInterimText],
  );

  /* ─── Voice input with auto-silence detection ─── */
  const voice = useVoiceInput({
    silenceMs: 1500,
    onSilenceDetected: processTranscript,
  });

  /* ─── Sync interim transcript into store ─── */
  useEffect(() => {
    setInterimText(voice.isListening ? voice.interimTranscript : "");
  }, [voice.interimTranscript, voice.isListening, setInterimText]);

  /* ─── Single button: Tap to Speak ─── */
  const handleMicToggle = useCallback(() => {
    if (voice.isListening) {
      // User manually stops → send whatever was captured.
      const text = voice.stopListening();
      setInterimText("");
      if (text) {
        processTranscript(text);
      } else {
        setStatus("ready");
      }
    } else {
      tts.stop();
      api.abort();
      voice.startListening();
      setStatus("listening");
    }
  }, [voice, tts, api, setStatus, setInterimText, processTranscript]);

  /* ─── Cancel (during thinking/speaking) ─── */
  const handleCancel = useCallback(() => {
    api.abort();
    tts.stop();
    voice.stopListening();
    processingRef.current = false;
    setInterimText("");
    setStatus("ready");
  }, [api, tts, voice, setStatus, setInterimText]);

  /* ─── Keyboard shortcuts ─── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;

      if (e.code === "Escape") {
        e.preventDefault();
        handleCancel();
        return;
      }

      if (e.code === "Space" && status !== "thinking" && status !== "speaking") {
        e.preventDefault();
        handleMicToggle();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [status, handleMicToggle, handleCancel]);

  /* ─── Derive button state ─── */
  const isBusy = status === "thinking" || status === "speaking";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-5 py-8">
      {/* Skip link */}
      <a
        href="#controls"
        className="
          sr-only focus:not-sr-only focus:fixed focus:left-4
          focus:top-4 focus:z-50 focus:rounded focus:bg-accent
          focus:px-4 focus:py-2 focus:text-surface-950
        "
      >
        Skip to controls
      </a>

      {Header}

      <MemoAvatar isSpeaking={tts.isSpeaking} />

      <MemoChatContainer />

      {/* Controls */}
      <div id="controls" className="mx-auto flex w-full max-w-xl gap-3">
        {isBusy ? (
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Cancel"
            className="
              flex flex-1 items-center justify-center gap-3
              rounded-xl bg-surface-700 px-6 py-4
              text-base font-semibold text-surface-100
              transition-all duration-200
              hover:bg-surface-600 active:scale-[.97]
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-accent focus-visible:ring-offset-2
              focus-visible:ring-offset-surface-950
            "
            style={{ touchAction: "manipulation" }}
          >
            {status === "thinking" && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-surface-400 border-t-accent" />
            )}
            {status === "speaking" && (
              <span className="text-xl" aria-hidden="true">🔊</span>
            )}
            {status === "thinking" ? "Thinking… tap to cancel" : "Speaking… tap to stop"}
          </button>
        ) : (
          <MicButton
            isListening={voice.isListening}
            onClick={handleMicToggle}
            disabled={false}
          />
        )}
      </div>

      <SettingsPanel
        voices={tts.voices}
        selectedVoiceName={tts.voiceConfig.voice?.name ?? ""}
        rate={tts.voiceConfig.rate}
        onVoiceChange={tts.setVoice}
        onRateChange={tts.setRate}
      />

      {/* Keyboard hints */}
      <p className="mx-auto mt-6 max-w-xl text-center text-xs text-surface-200/30">
        <kbd className="rounded border border-surface-700 px-1.5 py-0.5 font-mono text-[0.65rem]">Space</kbd>{" "}
        to speak · <kbd className="rounded border border-surface-700 px-1.5 py-0.5 font-mono text-[0.65rem]">Esc</kbd>{" "}
        to cancel · Auto-sends after you pause
      </p>
    </main>
  );
}
