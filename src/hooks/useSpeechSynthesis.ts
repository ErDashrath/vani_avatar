import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceConfig } from "../types";

interface UseSpeechSynthesisReturn {
  isSupported: boolean;
  isSpeaking: boolean;
  lastError: string | null;
  voices: SpeechSynthesisVoice[];
  voiceConfig: VoiceConfig;
  setVoice: (v: SpeechSynthesisVoice) => void;
  setRate: (r: number) => void;
  prime: () => void;
  speak: (text: string) => Promise<void>;
  speakQueued: (text: string) => void;
  whenDone: () => Promise<void>;
  stop: () => void;
}

const MAX_CHUNK_CHARS = 180;
const CHUNK_STALL_TIMEOUT_MS = 12_000;
const START_STALL_TIMEOUT_MS = 2_500;
const MAX_CHUNK_RETRIES = 1;

interface SpeechChunk {
  text: string;
  attempts: number;
}

const normalizeText = (text: string): string => text.replace(/\s+/g, " ").trim();

const chunkForSpeech = (text: string): string[] => {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const sentenceLike = normalized.match(/[^.!?]+[.!?]?/g) ?? [normalized];
  const chunks: string[] = [];

  for (const rawPart of sentenceLike) {
    let part = normalizeText(rawPart);
    while (part.length > MAX_CHUNK_CHARS) {
      let splitAt = part.lastIndexOf(" ", MAX_CHUNK_CHARS);
      if (splitAt < 40) splitAt = MAX_CHUNK_CHARS;
      const head = normalizeText(part.slice(0, splitAt));
      if (head) chunks.push(head);
      part = normalizeText(part.slice(splitAt));
    }
    if (part) chunks.push(part);
  }

  return chunks;
};

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const synthRef = useRef<SpeechSynthesis | null>(
    typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null,
  );

  const [lastError, setLastError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>({
    voice: null,
    rate: 1,
    pitch: 1,
  });

  const queueRef = useRef<SpeechChunk[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const queueRunningRef = useRef(false);
  const doneResolversRef = useRef<Array<() => void>>([]);
  const primedRef = useRef(false);
  const voiceConfigRef = useRef(voiceConfig);
  const chunkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    voiceConfigRef.current = voiceConfig;
  }, [voiceConfig]);

  const clearChunkTimeout = useCallback(() => {
    if (!chunkTimeoutRef.current) return;
    clearTimeout(chunkTimeoutRef.current);
    chunkTimeoutRef.current = null;
  }, []);

  const clearStartTimeout = useCallback(() => {
    if (!startTimeoutRef.current) return;
    clearTimeout(startTimeoutRef.current);
    startTimeoutRef.current = null;
  }, []);

  const resolveDoneWaiters = useCallback(() => {
    if (!doneResolversRef.current.length) return;
    doneResolversRef.current.forEach((resolve) => resolve());
    doneResolversRef.current = [];
  }, []);

  useEffect(() => {
    const synth = synthRef.current;
    if (!synth) return;

    const loadVoices = () => {
      const all = synth.getVoices();
      const englishFirst = [...all].sort((a, b) => {
        const aEn = a.lang.toLowerCase().startsWith("en");
        const bEn = b.lang.toLowerCase().startsWith("en");
        if (aEn === bEn) return 0;
        return aEn ? -1 : 1;
      });

      setVoices(englishFirst);
      setVoiceConfig((cfg) => {
        if (cfg.voice) return cfg;
        const preferred = englishFirst.find((v) =>
          /female|samantha|google us english|en-us|en-gb/i.test(v.name),
        ) ?? englishFirst[0] ?? null;
        return { ...cfg, voice: preferred };
      });
    };

    loadVoices();
    synth.onvoiceschanged = loadVoices;
    let pollCount = 0;
    const poll = setInterval(() => {
      pollCount += 1;
      loadVoices();
      if (synth.getVoices().length > 0 || pollCount >= 10) clearInterval(poll);
    }, 500);

    return () => {
      clearInterval(poll);
      if (synth.onvoiceschanged === loadVoices) synth.onvoiceschanged = null;
    };
  }, []);

  const setVoice = useCallback((v: SpeechSynthesisVoice) => {
    setVoiceConfig((cfg) => ({ ...cfg, voice: v }));
  }, []);

  const setRate = useCallback((r: number) => {
    setVoiceConfig((cfg) => ({ ...cfg, rate: r }));
  }, []);

  const pickVoice = useCallback((candidate: SpeechSynthesisVoice | null): SpeechSynthesisVoice | null => {
    const synth = synthRef.current;
    if (!synth) return null;
    const available = synth.getVoices();
    if (!available.length) return null;

    if (candidate) {
      const matched = available.find((v) => v.voiceURI === candidate.voiceURI);
      if (matched) return matched;
    }

    return available.find((v) => v.lang.toLowerCase().startsWith("en")) ?? available[0] ?? null;
  }, []);

  const drainQueue = useCallback(() => {
    const synth = synthRef.current;
    if (!synth) {
      queueRef.current = [];
      queueRunningRef.current = false;
      clearChunkTimeout();
      clearStartTimeout();
      setLastError((prev) => prev ?? "Speech synthesis is not supported on this browser.");
      setIsSpeaking(false);
      resolveDoneWaiters();
      return;
    }

    if (queueRunningRef.current) return;
    const next = queueRef.current.shift();
    if (!next) {
      clearChunkTimeout();
      clearStartTimeout();
      setIsSpeaking(false);
      resolveDoneWaiters();
      return;
    }

    queueRunningRef.current = true;

    const cfg = voiceConfigRef.current;
    const utterance = new SpeechSynthesisUtterance(next.text);
    utterance.rate = cfg.rate;
    utterance.pitch = cfg.pitch;
    const selectedVoice = pickVoice(cfg.voice);
    if (selectedVoice) utterance.voice = selectedVoice;
    let didStart = false;

    const finishChunk = (opts?: { retry?: boolean; reason?: string }) => {
      clearChunkTimeout();
      clearStartTimeout();
      queueRunningRef.current = false;
      utteranceRef.current = null;
      if (opts?.reason) setLastError(opts.reason);

      if (opts?.retry && next.attempts < MAX_CHUNK_RETRIES) {
        queueRef.current.unshift({ text: next.text, attempts: next.attempts + 1 });
      }

      if (queueRef.current.length > 0) {
        drainQueue();
      } else {
        setIsSpeaking(false);
        resolveDoneWaiters();
      }
    };

    utterance.onstart = () => {
      didStart = true;
      clearStartTimeout();
      setIsSpeaking(true);
      setLastError(null);
    };
    utterance.onend = finishChunk;
    utterance.onerror = (event) => {
      finishChunk({
        retry: true,
        reason: `Speech synthesis error: ${event.error || "unknown"}.`,
      });
    };

    utteranceRef.current = utterance;

    // Failsafe for browsers that never emit onstart.
    clearStartTimeout();
    startTimeoutRef.current = setTimeout(() => {
      if (didStart) return;
      finishChunk({
        retry: true,
        reason: "Speech did not start in time.",
      });
    }, START_STALL_TIMEOUT_MS);

    // Failsafe for browsers that never emit onend/onerror for a chunk.
    clearChunkTimeout();
    chunkTimeoutRef.current = setTimeout(() => {
      finishChunk({
        retry: true,
        reason: "Speech chunk timed out.",
      });
    }, CHUNK_STALL_TIMEOUT_MS);

    try {
      if (synth.speaking) synth.cancel();
      if (synth.paused) synth.resume();
      synth.speak(utterance);
    } catch {
      finishChunk({
        retry: true,
        reason: "Speech synthesis failed to start.",
      });
    }
  }, [clearChunkTimeout, clearStartTimeout, pickVoice, resolveDoneWaiters]);

  const prime = useCallback(() => {
    const synth = synthRef.current;
    if (!synth) {
      setLastError((prev) => prev ?? "Speech synthesis is not supported on this browser.");
      return;
    }
    if (primedRef.current) return;

    try {
      // Keep prime side-effect free: only warm browser internals without
      // injecting a synthetic utterance that can get stuck on some mobiles.
      synth.getVoices();
      if (synth.paused) synth.resume();
      primedRef.current = true;
      setLastError(null);
    } catch {
      setLastError("Failed to initialize speech synthesis.");
      primedRef.current = true;
    }
  }, []);

  useEffect(() => {
    const warmUp = () => {
      prime();
    };
    window.addEventListener("pointerdown", warmUp, { passive: true });
    window.addEventListener("keydown", warmUp);
    return () => {
      window.removeEventListener("pointerdown", warmUp);
      window.removeEventListener("keydown", warmUp);
    };
  }, [prime]);

  const speakQueued = useCallback((text: string) => {
    prime();
    const chunks = chunkForSpeech(text);
    if (!chunks.length) return;
    setLastError(null);
    queueRef.current.push(...chunks.map((chunk) => ({ text: chunk, attempts: 0 })));
    drainQueue();
  }, [drainQueue, prime]);

  const whenDone = useCallback((): Promise<void> => {
    if (!queueRunningRef.current && queueRef.current.length === 0) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      doneResolversRef.current.push(resolve);
    });
  }, []);

  const stop = useCallback(() => {
    const synth = synthRef.current;
    queueRef.current = [];
    queueRunningRef.current = false;
    clearChunkTimeout();
    clearStartTimeout();

    try {
      synth?.cancel();
      if (synth?.paused) synth.resume();
    } catch {
      // ignore cancel/resume exceptions
    }

    utteranceRef.current = null;
    setIsSpeaking(false);
    resolveDoneWaiters();
  }, [clearChunkTimeout, clearStartTimeout, resolveDoneWaiters]);

  const speak = useCallback(async (text: string): Promise<void> => {
    stop();
    speakQueued(text);
    await whenDone();
  }, [speakQueued, stop, whenDone]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isSupported: synthRef.current !== null,
    isSpeaking,
    lastError,
    voices,
    voiceConfig,
    setVoice,
    setRate,
    prime,
    speak,
    speakQueued,
    whenDone,
    stop,
  };
}
