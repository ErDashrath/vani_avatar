import { useCallback, useEffect, useRef, useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "./components/Avatar/Avatar";
import { MicButton } from "./components/Controls/MicButton";
import { KeyboardIcon, MicIcon, SendIcon } from "./components/UI/icons";
import { AudioWaveform } from "./components/UI/AudioWaveform";
import { useVoiceInput } from "./hooks/useVoiceInput";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis";
import { useChatAPI } from "./hooks/useChatAPI";
import { useChatStore } from "./store/chatStore";
import { useTheme } from "./hooks/useTheme";
import type { ChatMessage } from "./types";
import { DEFAULT_HUMAN_AVATAR_ID } from "./utils/constants";
import type React from "react";

const MemoAvatar = memo(Avatar);

const AVATAR_OPTIONS = [
  { id: "emp1", type: "gif" as const, label: "Emp 1", thumb: "/assets/emp1.gif" },
  { id: "emp2", type: "gif" as const, label: "Emp 2", thumb: "/assets/emp2.gif" },
  { id: "emp3", type: "gif" as const, label: "Emp 3", thumb: "/assets/emp3.gif" },
  { id: "dashrath", type: "gif" as const, label: "Dashrath", thumb: "/assets/dashrath.gif" },
  { id: "women", type: "gif" as const, label: "Women", thumb: "/assets/women.gif" },
];

export default function App() {
  const tts = useSpeechSynthesis();
  const api = useChatAPI();
  useTheme();

  const status = useChatStore((s) => s.status);
  const setStatus = useChatStore((s) => s.setStatus);
  const setInterimText = useChatStore((s) => s.setInterimText);
  const addMessage = useChatStore((s) => s.addMessage);
  const interimText = useChatStore((s) => s.interimText);
  const messages = useChatStore((s) => s.messages);
  const avatarId = useChatStore((s) => s.avatarId);
  const setAvatarId = useChatStore((s) => s.setAvatarId);
  const setAvatarType = useChatStore((s) => s.setAvatarType);

  const processingRef = useRef(false);

  // Input mode
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [manualText, setManualText] = useState("");

  // Left sidebar (collapsed icon-only or expanded) — desktop only
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Right panel / bottom sheet tabs
  const [rightTab, setRightTab] = useState<"chat" | "avatar" | "voice">("chat");

  // Mobile bottom sheet open/closed
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // Keep persisted avatar settings human-only and GIF-only.
  useEffect(() => {
    const allowedIds = new Set(AVATAR_OPTIONS.map((av) => av.id));
    if (!allowedIds.has(avatarId)) {
      setAvatarId(DEFAULT_HUMAN_AVATAR_ID);
    }
    if (useChatStore.getState().avatarType !== "gif") {
      setAvatarType("gif");
    }
  }, [avatarId, setAvatarId, setAvatarType]);

  // Chat scroll — auto-switch to chat tab when a message or interim text arrives
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (messages.length > 0 || interimText) {
      setRightTab("chat");
      setMobileSheetOpen(true);
    }
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interimText]);

  /* ─── Process transcript ─── */
  const processTranscript = useCallback(
    async (text: string) => {
      if (!text || processingRef.current) return;
      tts.prime();
      processingRef.current = true;
      setInterimText("");
      addMessage("user", text);
      setStatus("thinking");
      const latestMessages = useChatStore.getState().messages;
      const history: ChatMessage[] = latestMessages.slice(-6).map((m) => ({
        role: m.role, content: m.content,
      }));

      // ── STREAMING TTS (sentence-by-sentence while API streams) ──
      // Commented out: starts speaking before the full reply arrives.
      // Re-enable if you want lower perceived latency.
      //
      // let lastSpokenIdx = 0;
      // const flushSentences = (accumulated: string, force = false) => {
      //   const re = /[^.!?]+[.!?]+(?:\s+|$)/g;
      //   let match;
      //   while ((match = re.exec(accumulated)) !== null) {
      //     const end = match.index + match[0].length;
      //     if (match.index >= lastSpokenIdx) {
      //       const sentence = match[0].trim();
      //       if (sentence.length > 1) {
      //         tts.speakQueued(sentence);
      //         if (useChatStore.getState().status !== "speaking") setStatus("speaking");
      //       }
      //       lastSpokenIdx = end;
      //     }
      //   }
      //   if (force) {
      //     const remaining = accumulated.slice(lastSpokenIdx).trim();
      //     if (remaining) {
      //       tts.speakQueued(remaining);
      //       if (useChatStore.getState().status !== "speaking") setStatus("speaking");
      //     }
      //     lastSpokenIdx = accumulated.length;
      //   }
      // };

      try {
        // Stream the response (updates interim text only — no TTS yet)
        const reply = await api.sendMessageStream(text, history, (partial) => {
          setInterimText(partial);
          // flushSentences(partial); // streaming TTS disabled
        });

        // ── FULL-RESPONSE TTS ──
        // Wait for the complete reply, then speak it all at once.
        setInterimText("");
        addMessage("assistant", reply);

        if (reply.trim()) {
          if (tts.isSupported) {
            setStatus("speaking");
            tts.speakQueued(reply);
            await tts.whenDone();
          } else {
            console.warn("[TTS] Speech synthesis is not supported in this browser.");
          }
        }

        setStatus("ready");
      } catch {
        if (useChatStore.getState().status !== "ready") {
          setStatus("error");
          addMessage("assistant", "Sorry, something went wrong.");
          setTimeout(() => setStatus("ready"), 2000);
        }
      } finally {
        processingRef.current = false;
      }
    },
    [api, tts, addMessage, setStatus, setInterimText],
  );

  /* ─── Voice ─── */
  const voice = useVoiceInput({ silenceMs: 1500, onSilenceDetected: processTranscript });
  useEffect(() => {
    setInterimText(voice.isListening ? voice.interimTranscript : "");
  }, [voice.interimTranscript, voice.isListening, setInterimText]);

  const handleMicToggle = useCallback(() => {
    if (voice.isListening) {
      const text = voice.stopListening();
      setInterimText("");
      if (text && !processingRef.current) processTranscript(text);
      else if (!processingRef.current) setStatus("ready");
    } else {
      tts.stop(); api.abort();
      tts.prime();
      voice.startListening(); setStatus("listening");
    }
  }, [voice, tts, api, setStatus, setInterimText, processTranscript]);

  const handleCancel = useCallback(() => {
    api.abort(); tts.stop(); voice.stopListening();
    processingRef.current = false;
    setInterimText(""); setStatus("ready");
  }, [api, tts, voice, setStatus, setInterimText]);

  const handleManualVoiceSend = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    const final = voice.stopListening();
    if (final.trim()) processTranscript(final);
    else handleCancel();
  }, [voice, processTranscript, handleCancel]);

  /* ─── Keyboard shortcuts ─── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Escape") { e.preventDefault(); handleCancel(); return; }
      if (e.code === "Space" && status !== "thinking" && status !== "speaking") {
        e.preventDefault(); handleMicToggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [status, handleMicToggle, handleCancel]);

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-black text-white overflow-hidden select-none">

      {/* ══════════════════════════════════════
          MOBILE TOP BAR
      ══════════════════════════════════════ */}
      <div className="md:hidden flex items-center justify-between px-4 h-12 border-b border-white/15 shrink-0 bg-black">
        <span className="text-white font-bold tracking-wide">EchoAI</span>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status === "listening" ? "bg-red-400 animate-pulse" :
            status === "thinking" ? "bg-yellow-400 animate-bounce" :
              status === "speaking" ? "bg-blue-400 animate-pulse" :
                "bg-white/20"
            }`} />
          <span className="text-xs text-white/40 capitalize">{status}</span>
        </div>
      </div>

      {/* ══════════════════════════════════════
          DESKTOP LEFT SIDEBAR
      ══════════════════════════════════════ */}
      <aside className={`
        hidden md:flex flex-shrink-0 flex-col
        bg-black border-r-2 border-white/20
        transition-all duration-300 ease-in-out z-30
        ${sidebarOpen ? "w-56" : "w-16"}
      `}>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center justify-center h-14 w-full border-b-2 border-white/20 hover:bg-white/5 transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {sidebarOpen
              ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
              : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
            }
          </svg>
        </button>
        {([
          { icon: "💬", label: "Chat", tab: "chat" as const },
          { icon: "🤖", label: "Avatar", tab: "avatar" as const },
          { icon: "🎙️", label: "Voice", tab: "voice" as const },
        ]).map((item) => (
          <button
            key={item.tab}
            onClick={() => setRightTab(item.tab)}
            className={`flex items-center gap-3 px-4 py-4 transition-colors text-sm font-medium border-l-2 border-transparent
              ${rightTab === item.tab ? "text-white bg-white/10 border-l-white" : "text-white/50 hover:text-white hover:bg-white/5"}`}
          >
            <span className="text-xl leading-none w-6 text-center">{item.icon}</span>
            {sidebarOpen && <span className="whitespace-nowrap">{item.label}</span>}
          </button>
        ))}
        <div className="flex-1" />
        <button className="flex items-center gap-3 px-4 py-4 text-white/50 hover:text-white hover:bg-white/5 transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          {sidebarOpen && <span className="text-sm whitespace-nowrap">Settings</span>}
        </button>
      </aside>

      {/* ══════════════════════════════════════
          MAIN CENTER — avatar + controls
      ══════════════════════════════════════ */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">

        {/* Avatar */}
        <div className={`
          flex-1 flex items-center justify-center bg-black overflow-hidden min-h-0
          md:m-4 md:border-2 md:border-white/20 md:rounded-2xl
          transition-all duration-300
        `}>
          <MemoAvatar
            isSpeaking={status === "speaking"}
            isThinking={status === "thinking"}
          />
        </div>

        {/* ── DESKTOP controls bar ── */}
        <div
          role="button" tabIndex={0}
          onClick={(e) => { e.preventDefault(); if (inputMode === "text") return; if (status === "ready") handleMicToggle(); else handleCancel(); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (inputMode === "text") return; if (status === "ready") handleMicToggle(); else handleCancel(); } }}
          className="hidden md:flex items-center justify-center gap-3 h-20 px-6 mx-4 mb-4 border-2 border-white/20 rounded-2xl bg-black cursor-pointer transition-all duration-200 hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 flex-shrink-0"
        >
          {inputMode === "voice" ? (
            <div className="flex items-center gap-4 w-full justify-center">
              <AnimatePresence mode="wait">
                {status === "ready" && (
                  <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3">
                    <MicButton isListening={false} onClick={handleMicToggle} disabled={false} />
                    <span className="text-sm text-white/50">Tap to speak</span>
                  </motion.div>
                )}
                {status === "listening" && (
                  <motion.div key="listening" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 w-full">
                    <span className="text-sm text-white/60 shrink-0">Listening</span>
                    <div className="flex-1 h-10"><AudioWaveform isActive={true} color="#3b82f6" /></div>
                    <button onClick={(e) => { e.stopPropagation(); handleManualVoiceSend(e); }} className="p-2.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white transition-colors shrink-0"><SendIcon size={18} /></button>
                  </motion.div>
                )}
                {status === "thinking" && (
                  <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                    <span className="text-sm text-white/60">Thinking</span>
                    <div className="flex gap-1">{[0, 150, 300].map((d) => <span key={d} className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div>
                  </motion.div>
                )}
                {status === "speaking" && (
                  <motion.div key="speaking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 w-full">
                    <span className="text-sm text-white/60 shrink-0">Speaking</span>
                    <div className="flex-1 h-10"><AudioWaveform isActive={true} color="#3b82f6" /></div>
                  </motion.div>
                )}
              </AnimatePresence>
              <button onClick={(e) => { e.stopPropagation(); setInputMode("text"); if (status === "listening") handleCancel(); }} className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors shrink-0" title="Type"><KeyboardIcon size={18} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full" onClick={(e) => e.stopPropagation()}>
              <textarea value={manualText} onChange={(e) => setManualText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (manualText.trim()) { processTranscript(manualText); setManualText(""); } } }}
                placeholder="Type a message..." className="flex-1 bg-transparent border-none outline-none resize-none text-white placeholder:text-white/30 text-sm h-12 py-3" autoFocus />
              <button onClick={() => { if (manualText.trim()) { processTranscript(manualText); setManualText(""); } }} disabled={!manualText.trim()} className="p-2.5 rounded-full bg-blue-500 hover:bg-blue-600 disabled:opacity-30 text-white transition-colors shrink-0"><SendIcon size={18} /></button>
              <button onClick={(e) => { e.stopPropagation(); setInputMode("voice"); }} className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors shrink-0"><MicIcon size={18} /></button>
            </div>
          )}
        </div>

        {/* Mobile controls moved down to bottom sheet container */}
      </main>

      {/* ══════════════════════════════════════
          DESKTOP RIGHT PANEL
      ══════════════════════════════════════ */}
      <aside className="hidden md:flex w-80 flex-shrink-0 flex-col border-l-2 border-white/20 bg-black overflow-hidden">
        <div className="flex items-center h-12 px-4 border-b-2 border-white/20 text-sm font-semibold text-white/80 shrink-0">
          {rightTab === "chat" ? "💬 Chat" : rightTab === "avatar" ? "🤖 Avatar" : "🎙️ Voice"}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {rightTab === "chat" && <ChatPanel messages={messages} interimText={interimText} status={status} chatEndRef={chatEndRef} />}
          {rightTab === "avatar" && <AvatarPanel avatarId={avatarId} setAvatarId={setAvatarId} setAvatarType={setAvatarType} />}
          {rightTab === "voice" && <VoicePanel tts={tts} status={status} />}
        </div>
      </aside>

      {/* ══════════════════════════════════════
          MOBILE BOTTOM SHEET + TAB BAR
      ══════════════════════════════════════ */}
      <div className="md:hidden flex flex-col shrink-0 border-t border-white/15 bg-black">
        {/* Sheet content */}
        <AnimatePresence>
          {mobileSheetOpen && (
            <motion.div
              key="sheet"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 280, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="h-full overflow-y-auto p-4">
                {rightTab === "chat" && <ChatPanel messages={messages} interimText={interimText} status={status} chatEndRef={chatEndRef} />}
                {rightTab === "avatar" && <AvatarPanel avatarId={avatarId} setAvatarId={setAvatarId} setAvatarType={setAvatarType} />}
                {rightTab === "voice" && <VoicePanel tts={tts} status={status} />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── MOBILE controls (Moved from main area) ── */}
        <div className="flex flex-col items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0 bg-black z-10 relative">
          {inputMode === "voice" ? (
            <div className="flex items-center gap-4 w-full justify-center">
              <AnimatePresence mode="wait">
                {status === "ready" && (
                  <motion.div key="idle" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                    className="flex flex-col items-center gap-2">
                    <button
                      onClick={handleMicToggle}
                      className="w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 flex items-center justify-center shadow-xl shadow-blue-600/40 transition-all duration-150"
                    >
                      <MicIcon size={30} />
                    </button>
                  </motion.div>
                )}
                {status === "listening" && (
                  <motion.div key="listening" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 w-full">
                    <div className="flex-1 h-12"><AudioWaveform isActive={true} color="#3b82f6" /></div>
                    <button onClick={(e) => { e.stopPropagation(); handleManualVoiceSend(e); }}
                      className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shrink-0">
                      <SendIcon size={20} />
                    </button>
                  </motion.div>
                )}
                {status === "thinking" && (
                  <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white/5 border-2 border-white/15 flex items-center justify-center shrink-0">
                      <div className="flex gap-1">{[0, 150, 300].map((d) => <span key={d} className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div>
                    </div>
                    <span className="text-sm text-white/60">Thinking...</span>
                  </motion.div>
                )}
                {status === "speaking" && (
                  <motion.div key="speaking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center w-full relative">
                    <button onClick={handleCancel}
                      className="w-16 h-16 rounded-full bg-white/5 border-2 border-blue-500/40 flex items-center justify-center">
                      <AudioWaveform isActive={true} color="#3b82f6" />
                    </button>
                    <span className="absolute right-0 text-xs text-white/40">Tap to stop</span>
                  </motion.div>
                )}
              </AnimatePresence>
              {status === "ready" && (
                <button onClick={() => setInputMode("text")}
                  className="absolute right-4 p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white transition-colors">
                  <KeyboardIcon size={20} />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full bg-white/5 border border-white/20 rounded-2xl px-3 py-1.5">
              <textarea value={manualText} onChange={(e) => setManualText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (manualText.trim()) { processTranscript(manualText); setManualText(""); } } }}
                placeholder="Type a message..." rows={1}
                className="flex-1 bg-transparent border-none outline-none resize-none text-white placeholder:text-white/30 text-base py-2.5" autoFocus />
              <button onClick={() => { if (manualText.trim()) { processTranscript(manualText); setManualText(""); } }} disabled={!manualText.trim()}
                className="p-2.5 rounded-full bg-blue-500 disabled:opacity-30 text-white shrink-0"><SendIcon size={18} /></button>
              <button onClick={() => setInputMode("voice")} className="p-2.5 text-white/50 hover:text-white shrink-0"><MicIcon size={20} /></button>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex">
          {(["chat", "avatar", "voice"] as const).map((tab) => (
            <button key={tab}
              onClick={() => {
                if (rightTab === tab) { setMobileSheetOpen(!mobileSheetOpen); }
                else { setRightTab(tab); setMobileSheetOpen(true); }
              }}
              className={`flex-1 py-3.5 flex flex-col items-center gap-0.5 text-xs font-medium transition-colors
                ${rightTab === tab && mobileSheetOpen ? "text-white bg-white/8" : "text-white/40"}`}>
              <span className="text-lg leading-none">{tab === "chat" ? "💬" : tab === "avatar" ? "🤖" : "🎙️"}</span>
              <span className="text-[10px]">{tab === "chat" ? "Chat" : tab === "avatar" ? "Avatar" : "Voice"}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}

/* ── Shared panel components ── */

function ChatPanel({ messages, interimText, status, chatEndRef }: {
  messages: ReturnType<typeof useChatStore.getState>["messages"];
  interimText: string; status: string;
  chatEndRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="flex flex-col gap-3">
      {messages.length === 0 && !interimText ? (
        <div className="flex flex-col items-center justify-center gap-3 text-white/25 py-8">
          <span className="text-3xl">💬</span>
          <p className="text-sm text-center">Start a conversation.<br />Your chat will appear here.</p>
        </div>
      ) : (
        <>
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs mt-0.5 ${msg.role === "user" ? "bg-blue-500" : "bg-white/10"}`}>
                {msg.role === "user" ? "U" : "AI"}
              </div>
              <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${msg.role === "user"
                ? "bg-blue-500/20 border border-blue-500/30 text-white rounded-tr-sm"
                : "bg-white/5 border border-white/10 text-white/90 rounded-tl-sm"
                }`}>{msg.content}</div>
            </div>
          ))}
          {interimText && status === "listening" && (
            <div className="flex gap-2 flex-row-reverse">
              <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs mt-0.5 bg-blue-500">U</div>
              <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-tr-sm text-sm leading-relaxed bg-blue-500/10 border border-blue-500/20 text-white/60 italic">
                {interimText}<span className="inline-block w-1.5 h-3.5 ml-0.5 bg-blue-400/60 animate-pulse rounded-sm" />
              </div>
            </div>
          )}
          {interimText && status === "speaking" && (
            <div className="flex gap-2 flex-row">
              <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs mt-0.5 bg-white/10">AI</div>
              <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-tl-sm text-sm leading-relaxed bg-white/5 border border-white/10 text-white/70">
                {interimText}<span className="inline-block w-1.5 h-3.5 ml-0.5 bg-white/40 animate-pulse rounded-sm" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </>
      )}
    </div>
  );
}

function AvatarPanel({ avatarId, setAvatarId, setAvatarType }: {
  avatarId: string;
  setAvatarId: (id: string) => void;
  setAvatarType: (type: "gif" | "image" | "realistic" | "photo") => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Choose Avatar</p>
      <div className="grid grid-cols-3 md:grid-cols-2 gap-3">
        {AVATAR_OPTIONS.map((av) => (
          <button key={av.id} onClick={() => { setAvatarId(av.id); setAvatarType(av.type); }}
            className={`flex flex-col items-center gap-2 p-2.5 rounded-xl border-2 transition-all duration-200
              ${avatarId === av.id ? "border-blue-500 bg-blue-500/10" : "border-white/15 hover:border-white/40 bg-white/5"}`}>
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden border-2 border-white/20 bg-white/5">
              <img src={av.thumb} alt={av.label} className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
                onError={(e) => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='%23334155'/%3E%3Ctext x='50' y='56' text-anchor='middle' font-size='32' fill='white'%3E🤖%3C/text%3E%3C/svg%3E"; }} />
            </div>
            <span className="text-xs text-white/80 font-medium text-center leading-tight">{av.label}</span>
            {avatarId === av.id && <span className="text-[10px] text-blue-400 font-semibold">Active</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function VoicePanel({ tts, status }: { tts: ReturnType<typeof useSpeechSynthesis>; status: string }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Voice Settings</p>
      <div className="flex flex-col gap-2">
        <label className="text-sm text-white/70 font-medium">Language / Voice</label>
        <select value={tts.voiceConfig.voice?.name ?? ""}
          onChange={(e) => { const v = tts.voices.find((v) => v.name === e.target.value); if (v) tts.setVoice(v); }}
          className="w-full bg-white/5 border-2 border-white/20 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer">
          <option value="" disabled className="bg-black">Select a voice...</option>
          {tts.voices.map((v) => <option key={v.name} value={v.name} className="bg-black text-white">{v.name} ({v.lang})</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-white/70 font-medium">Speed</label>
          <span className="text-sm text-white font-semibold">{tts.voiceConfig.rate.toFixed(1)}x</span>
        </div>
        <input type="range" min="0.5" max="2" step="0.1" value={tts.voiceConfig.rate}
          onChange={(e) => tts.setRate(parseFloat(e.target.value))} className="w-full accent-blue-500 cursor-pointer" />
        <div className="flex justify-between text-xs text-white/30"><span>0.5x Slow</span><span>2x Fast</span></div>
      </div>
      {!tts.isSupported && (
        <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-200 leading-relaxed">
          Speech output is not supported on this browser/device. Try Chrome, Edge, or Safari with system audio enabled.
        </div>
      )}
      {tts.isSupported && tts.lastError && (
        <div className="p-3 rounded-xl border border-yellow-400/30 bg-yellow-500/10 text-xs text-yellow-100 leading-relaxed">
          {tts.lastError}
        </div>
      )}
      <div className="p-3 rounded-xl border border-white/10 bg-white/5 flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${status === "listening" ? "bg-red-500 animate-pulse" :
          status === "thinking" ? "bg-yellow-400 animate-bounce" :
            status === "speaking" ? "bg-blue-400 animate-pulse" : "bg-white/20"}`} />
        <span className="text-sm text-white/60 capitalize">{status}</span>
      </div>
    </div>
  );
}
