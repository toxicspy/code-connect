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
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0 rounded-full text-current opacity-70 transition-opacity hover:opacity-100"
      onClick={handleSpeak}
      aria-label={isSpeaking ? "Stop translated audio" : `Play translated audio in ${language}`}
      title={isSpeaking ? "Stop" : `Listen in ${language}`}
    >
      {isSpeaking ? <Square className="h-3.5 w-3.5 fill-current" /> : <Volume2 className="h-3.5 w-3.5" />}
    </Button>
  );
};

export default TranslatedAudioButton;
