/**
 * useSpeechSynthesis – TTS hook wrapping the Web Speech API.
 *
 * skills.sh applied:
 *  • rerender-lazy-state-init → voices loaded once via onvoiceschanged
 *  • rerender-functional-setstate → stable updates
 *  • Web Guidelines → prefers-reduced-motion honoured in avatar, not TTS
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceConfig } from "../types";

interface UseSpeechSynthesisReturn {
  isSpeaking: boolean;
  voices: SpeechSynthesisVoice[];
  voiceConfig: VoiceConfig;
  setVoice: (v: SpeechSynthesisVoice) => void;
  setRate: (r: number) => void;
  speak: (text: string) => Promise<void>;
  stop: () => void;
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>({
    voice: null,
    rate: 1,
    pitch: 1,
  });

  const synth = useRef(window.speechSynthesis);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const resumeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Chrome pauses TTS after ~15s. This keepalive prevents it. */
  const startKeepAlive = useCallback(() => {
    stopKeepAlive();
    resumeIntervalRef.current = setInterval(() => {
      if (synth.current.speaking && !synth.current.paused) {
        synth.current.pause();
        synth.current.resume();
      }
    }, 10_000);
  }, []);

  const stopKeepAlive = useCallback(() => {
    if (resumeIntervalRef.current) {
      clearInterval(resumeIntervalRef.current);
      resumeIntervalRef.current = null;
    }
  }, []);

  // Load available English voices.
  useEffect(() => {
    const load = () => {
      const all = synth.current.getVoices();
      const en = all.filter((v) => v.lang.startsWith("en"));
      setVoices(en);

      // Pick a good default.
      if (!voiceConfig.voice) {
        const preferred = en.find(
          (v) =>
            v.name.includes("Female") ||
            v.name.includes("Samantha") ||
            v.name.includes("Google US English"),
        ) ?? en[0] ?? null;

        setVoiceConfig((c) => ({ ...c, voice: preferred }));
      }
    };

    load();
    synth.current.onvoiceschanged = load;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setVoice = useCallback(
    (v: SpeechSynthesisVoice) => setVoiceConfig((c) => ({ ...c, voice: v })),
    [],
  );

  const setRate = useCallback(
    (r: number) => setVoiceConfig((c) => ({ ...c, rate: r })),
    [],
  );

  const speak = useCallback(
    (text: string): Promise<void> =>
      new Promise((resolve, reject) => {
        synth.current.cancel();

        const utt = new SpeechSynthesisUtterance(text);
        utt.voice = voiceConfig.voice;
        utt.rate = voiceConfig.rate;
        utt.pitch = voiceConfig.pitch;

        utt.onstart = () => {
          setIsSpeaking(true);
          startKeepAlive();
        };
        utt.onend = () => {
          setIsSpeaking(false);
          stopKeepAlive();
          resolve();
        };
        utt.onerror = (e) => {
          setIsSpeaking(false);
          stopKeepAlive();
          // "interrupted" fires when we cancel intentionally – not a real error
          if (e.error === "interrupted" || e.error === "canceled") {
            resolve();
            return;
          }
          reject(new Error(`SpeechSynthesis error: ${e.error}`));
        };

        utteranceRef.current = utt;
        synth.current.speak(utt);
      }),
    [voiceConfig, startKeepAlive, stopKeepAlive],
  );

  const stop = useCallback(() => {
    synth.current.cancel();
    stopKeepAlive();
    setIsSpeaking(false);
  }, [stopKeepAlive]);

  return { isSpeaking, voices, voiceConfig, setVoice, setRate, speak, stop };
}
