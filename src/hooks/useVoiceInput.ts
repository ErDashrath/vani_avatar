/**
 * useVoiceInput – Web Speech API hook with auto-silence detection.
 *
 * Flow: start → listen → detect 1.5s silence → auto-finalize transcript.
 * The caller gets notified via onSilenceDetected callback.
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface UseVoiceInputOptions {
  /** Called when user stops speaking for silenceMs. Receives final text. */
  onSilenceDetected?: (transcript: string) => void;
  /** Silence threshold in ms before auto-send (default 1500). */
  silenceMs?: number;
}

interface UseVoiceInputReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  startListening: () => void;
  stopListening: () => string;
  resetTranscript: () => void;
}

const normalizeTranscript = (text: string): string => text.replace(/\s+/g, " ").trim();

// Some mobile SR engines repeat finalized words inside interim chunks.
const mergeTranscriptParts = (finalText: string, interimText: string): string => {
  const base = normalizeTranscript(finalText);
  const live = normalizeTranscript(interimText);

  if (!base) return live;
  if (!live) return base;
  if (base === live) return base;
  if (live.startsWith(base)) return live;
  if (base.startsWith(live)) return base;

  const baseWords = base.split(" ");
  const liveWords = live.split(" ");
  const overlapLimit = Math.min(baseWords.length, liveWords.length);

  for (let overlap = overlapLimit; overlap > 0; overlap -= 1) {
    const baseSuffix = baseWords.slice(baseWords.length - overlap).join(" ");
    const livePrefix = liveWords.slice(0, overlap).join(" ");
    if (baseSuffix === livePrefix) {
      const tail = liveWords.slice(overlap).join(" ");
      return normalizeTranscript(`${base} ${tail}`);
    }
  }

  return normalizeTranscript(`${base} ${live}`);
};

export function useVoiceInput(opts: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const { onSilenceDetected, silenceMs = 1500 } = opts;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const accumulatedRef = useRef("");
  const intentionalStopRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSpokenRef = useRef(false);
  const onSilenceRef = useRef(onSilenceDetected);
  const finalSegmentsRef = useRef<Record<number, string>>({});
  // Tracks the latest non-final chunk from the current recognition session.
  const currentSessionInterimRef = useRef("");

  // Keep callback ref in sync (no stale closures).
  useEffect(() => {
    onSilenceRef.current = onSilenceDetected;
  }, [onSilenceDetected]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const startSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      const final = mergeTranscriptParts(accumulatedRef.current, currentSessionInterimRef.current);
      // Only auto-send if user actually spoke something.
      if (hasSpokenRef.current && final) {
        intentionalStopRef.current = true;
        recognitionRef.current?.stop();
        setIsListening(false);
        accumulatedRef.current = ""; // clear so a late onend can't re-send
        currentSessionInterimRef.current = "";
        finalSegmentsRef.current = {};
        hasSpokenRef.current = false;
        setTranscript("");
        setInterimTranscript("");
        onSilenceRef.current?.(final);
      }
    }, silenceMs);
  }, [silenceMs, clearSilenceTimer]);

  // Lazily initialise recognition once.
  const getRecognition = useCallback((): SpeechRecognition | null => {
    if (recognitionRef.current) return recognitionRef.current;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      // Update finalized result slots from changed indices.
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = normalizeTranscript(event.results[i][0]?.transcript ?? "");
        if (!text) continue;
        if (event.results[i].isFinal) finalSegmentsRef.current[i] = text;
        else delete finalSegmentsRef.current[i];
      }

      const finalized = Object.keys(finalSegmentsRef.current)
        .map(Number)
        .sort((a, b) => a - b)
        .map((index) => finalSegmentsRef.current[index])
        .reduce((acc, part) => mergeTranscriptParts(acc, part), "");

      let currentInterim = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) continue;
        const text = normalizeTranscript(event.results[i][0]?.transcript ?? "");
        if (!text) continue;
        currentInterim = mergeTranscriptParts(currentInterim, text);
      }

      accumulatedRef.current = finalized;
      currentSessionInterimRef.current = currentInterim;

      const merged = mergeTranscriptParts(finalized, currentInterim);
      setTranscript(finalized);
      setInterimTranscript(merged);

      hasSpokenRef.current = merged.length > 0;
      if (hasSpokenRef.current) startSilenceTimer();
    };

    rec.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      console.error("[useVoiceInput] error:", event.error);
      intentionalStopRef.current = true;
      clearSilenceTimer();
      setIsListening(false);
    };

    rec.onend = () => {
      // Finals are already accumulated in onresult — nothing to merge here.
      currentSessionInterimRef.current = "";

      if (!intentionalStopRef.current) {
        try {
          rec.start();
          return;
        } catch { }
      }
      clearSilenceTimer();
      setIsListening(false);
    };

    recognitionRef.current = rec;
    return rec;
  }, [startSilenceTimer, clearSilenceTimer]);

  const startListening = useCallback(() => {
    const rec = getRecognition();
    if (!rec) {
      alert("Speech Recognition not supported. Please use Chrome or Edge.");
      return;
    }
    accumulatedRef.current = "";
    currentSessionInterimRef.current = "";
    finalSegmentsRef.current = {};
    intentionalStopRef.current = false;
    hasSpokenRef.current = false;
    setTranscript("");
    setInterimTranscript("");
    try {
      rec.start();
      setIsListening(true);
    } catch {
      console.warn("[useVoiceInput] recognition already running");
    }
  }, [getRecognition]);

  const stopListening = useCallback((): string => {
    intentionalStopRef.current = true;
    clearSilenceTimer();

    // Construct final result BEFORE aborting/stopping to ensure we capture everything
    const final = mergeTranscriptParts(accumulatedRef.current, currentSessionInterimRef.current);

    try {
      recognitionRef.current?.abort();
    } catch {
      recognitionRef.current?.stop();
    }

    setIsListening(false);
    setInterimTranscript("");

    // Reset refs appropriately
    accumulatedRef.current = "";
    currentSessionInterimRef.current = "";
    finalSegmentsRef.current = {};
    hasSpokenRef.current = false;

    return final;
  }, [clearSilenceTimer]);

  const resetTranscript = useCallback(() => {
    accumulatedRef.current = "";
    currentSessionInterimRef.current = "";
    finalSegmentsRef.current = {};
    hasSpokenRef.current = false;
    setTranscript("");
    setInterimTranscript("");
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      intentionalStopRef.current = true;
      clearSilenceTimer();
      recognitionRef.current?.abort();
    };
  }, [clearSilenceTimer]);

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
  };
}
