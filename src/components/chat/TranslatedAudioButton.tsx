import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, Square } from "lucide-react";

interface TranslatedAudioButtonProps {
  text: string;
  language: string;
}

const languageCodeMap: Record<string, string> = {
  Kannada: "kn-IN",
  Hindi: "hi-IN",
  Tamil: "ta-IN",
  Telugu: "te-IN",
  Malayalam: "ml-IN",
  Bengali: "bn-IN",
  Marathi: "mr-IN",
  Gujarati: "gu-IN",
  Punjabi: "pa-IN",
  Urdu: "ur-IN",
  Spanish: "es-ES",
  French: "fr-FR",
  German: "de-DE",
  Japanese: "ja-JP",
  Korean: "ko-KR",
  Chinese: "zh-CN",
  Arabic: "ar-SA",
  Portuguese: "pt-PT",
  Russian: "ru-RU",
  Italian: "it-IT",
};

const findBestVoice = (voices: SpeechSynthesisVoice[], langCode: string) => {
  const exactVoice = voices.find((voice) => voice.lang === langCode);
  if (exactVoice) return exactVoice;

  const languagePrefix = langCode.split("-")[0];
  return voices.find((voice) => voice.lang.toLowerCase().startsWith(languagePrefix.toLowerCase())) ?? null;
};

const TranslatedAudioButton = ({ text, language }: TranslatedAudioButtonProps) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speakTimeoutRef = useRef<number | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  const langCode = useMemo(() => languageCodeMap[language] || "en-US", [language]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const synth = window.speechSynthesis;
    const loadVoices = () => {
      voicesRef.current = synth.getVoices();
    };

    loadVoices();
    synth.resume();

    if (voicesRef.current.length === 0) {
      synth.addEventListener("voiceschanged", loadVoices);
    }

    return () => {
      if (speakTimeoutRef.current) {
        window.clearTimeout(speakTimeoutRef.current);
        speakTimeoutRef.current = null;
      }
      synth.removeEventListener("voiceschanged", loadVoices);
      synth.cancel();
      utteranceRef.current = null;
    };
  }, []);

  if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  const stopSpeaking = () => {
    if (speakTimeoutRef.current) {
      window.clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setIsSpeaking(false);
  };

  const handleSpeak = () => {
    if (isSpeaking) {
      stopSpeaking();
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();
    synth.resume();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = 0.98;
    utterance.pitch = 1;

    const voice = findBestVoice(voicesRef.current, langCode);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
    };
    utterance.onend = () => {
      utteranceRef.current = null;
      setIsSpeaking(false);
    };
    utterance.onerror = () => {
      utteranceRef.current = null;
      setIsSpeaking(false);
    };

    utteranceRef.current = utterance;
    setIsSpeaking(true);

    // A short defer after cancel() avoids browser speech queue stalls.
    speakTimeoutRef.current = window.setTimeout(() => {
      synth.speak(utterance);
      speakTimeoutRef.current = null;
    }, 30);
  };

  return (
    <button
      type="button"
      onClick={handleSpeak}
      aria-label={isSpeaking ? "Stop translated audio" : `Play translated audio in ${language}`}
      title={isSpeaking ? "Stop" : `Listen in ${language}`}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
        isSpeaking
          ? "scale-110 animate-pulse border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/40"
          : "border-primary/80 bg-primary text-primary-foreground hover:scale-110 hover:shadow-lg hover:shadow-primary/30"
      }`}
    >
      {isSpeaking ? <Square className="h-4 w-4 fill-current" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
};

export default TranslatedAudioButton;
