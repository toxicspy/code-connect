import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

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

const TranslatedAudioButton = ({ text, language }: TranslatedAudioButtonProps) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const langCode = useMemo(() => languageCodeMap[language] || "en-US", [language]);

  useEffect(() => {
    return () => {
      if (utteranceRef.current) {
        window.speechSynthesis.cancel();
        utteranceRef.current = null;
      }
    };
  }, []);

  if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setIsSpeaking(false);
  };

  const handleSpeak = () => {
    if (isSpeaking) {
      stopSpeaking();
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = 0.95;
    utterance.pitch = 1;
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
    window.speechSynthesis.speak(utterance);
  };

  return (
    <button
      type="button"
      onClick={handleSpeak}
      aria-label={isSpeaking ? "Stop translated audio" : `Play translated audio in ${language}`}
      title={isSpeaking ? "Stop" : `Listen in ${language}`}
      className={`inline-flex items-center justify-center h-8 w-8 shrink-0 rounded-full border-2 transition-all ${
        isSpeaking
          ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/40 scale-110 animate-pulse"
          : "bg-primary border-primary/80 text-primary-foreground hover:shadow-lg hover:shadow-primary/30 hover:scale-110"
      }`}
    >
      {isSpeaking ? <Square className="h-4 w-4 fill-current" /> : <Volume2 className="h-4 w-4" />}
    </button>
    </Button>
  );
};

export default TranslatedAudioButton;
