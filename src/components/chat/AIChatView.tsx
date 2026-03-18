import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAIChatMessages } from "@/hooks/useAIChatMessages";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";
import TranslationSettings from "./TranslationSettings";
import ChatInput from "./ChatInput";
import ReactMarkdown from "react-markdown";

export interface AIProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  system_prompt: string | null;
}

interface AIChatViewProps {
  aiProfile: AIProfile | null;
  onBack?: () => void;
}

const AIChatView = ({ aiProfile, onBack }: AIChatViewProps) => {
  const { user } = useAuth();
  const { messages, loading, streaming, sendMessage } = useAIChatMessages(aiProfile?.id ?? null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Translation state
  const [translateEnabled, setTranslateEnabled] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState("Kannada");
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<Set<string>>(new Set());
  const [failedTranslations, setFailedTranslations] = useState<Set<string>>(new Set());
  const [isRateLimited, setIsRateLimited] = useState(false);
  const processingRef = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    setTranslations({});
    setTranslating(new Set());
    setFailedTranslations(new Set());
    setIsRateLimited(false);
    processingRef.current = false;
  }, [aiProfile?.id, translateEnabled, targetLanguage]);

  const translateText = useCallback(async (msgId: string, text: string) => {
    if (translations[msgId] || translating.has(msgId) || failedTranslations.has(msgId)) return "skip" as const;
    setTranslating((prev) => new Set(prev).add(msgId));
    try {
      const { data, error } = await supabase.functions.invoke("translate", { body: { text, targetLanguage } });
      const responseError = error?.message || data?.error;
      if (responseError) {
        if (responseError.includes("429") || responseError.toLowerCase().includes("rate limit")) {
          setIsRateLimited(true);
          toast.error("Too many translation requests. Please wait.");
          return "rate_limited" as const;
        }
        setFailedTranslations((prev) => new Set(prev).add(msgId));
        return "failed" as const;
      }
      setTranslations((prev) => ({ ...prev, [msgId]: data.translated }));
      return "ok" as const;
    } catch {
      setFailedTranslations((prev) => new Set(prev).add(msgId));
      return "failed" as const;
    } finally {
      setTranslating((prev) => { const n = new Set(prev); n.delete(msgId); return n; });
    }
  }, [targetLanguage, translations, translating, failedTranslations]);

  useEffect(() => {
    if (!translateEnabled || !targetLanguage || messages.length === 0 || isRateLimited) return;
    if (processingRef.current) return;
    const untranslated = messages.filter((m) => !translations[m.id] && !translating.has(m.id) && !failedTranslations.has(m.id));
    if (untranslated.length === 0) return;
    let cancelled = false;
    processingRef.current = true;
    const processQueue = async () => {
      for (const msg of untranslated) {
        if (cancelled) break;
        const result = await translateText(msg.id, msg.content);
        if (result === "rate_limited") break;
        if (!cancelled) await new Promise((r) => setTimeout(r, 2000));
      }
    };
    processQueue().catch(console.error).finally(() => { processingRef.current = false; });
    return () => { cancelled = true; };
  }, [translateEnabled, targetLanguage, messages, translations, translating, failedTranslations, isRateLimited, translateText]);

  const handleSend = async () => {
    if (!input.trim() || streaming) return;
    const text = input;
    setInput("");
    try {
      await sendMessage(text, aiProfile?.system_prompt || "You are a helpful AI assistant.");
    } catch (err: any) {
      toast.error(err.message || "Failed to get AI response");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (!aiProfile) {
    return (
      <div className="flex h-full flex-col items-center justify-center chat-area-bg">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-8 w-8 text-primary/40" />
        </div>
        <h3 className="mt-4 font-display text-lg font-semibold text-muted-foreground">
          Select or create an AI chat
        </h3>
        <p className="mt-1 text-sm text-muted-foreground/60">
          Create a custom AI assistant to start chatting
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b chat-header-bg px-4 py-3">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 md:hidden">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-semibold text-primary overflow-hidden">
          {aiProfile.avatar_url ? (
            <img src={aiProfile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <Bot className="h-5 w-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">{aiProfile.name}</h3>
          <p className="text-xs text-muted-foreground">AI Assistant</p>
        </div>
        <TranslationSettings
          enabled={translateEnabled}
          targetLanguage={targetLanguage}
          onToggle={setTranslateEnabled}
          onLanguageChange={setTargetLanguage}
        />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto chat-area-bg px-4 py-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-8 text-sm text-muted-foreground">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bot className="h-12 w-12 text-primary/30 mb-3" />
            <p className="text-sm text-muted-foreground">Start chatting with {aiProfile.name}! 🤖</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.role === "user";
            const translated = translations[msg.id];
            const isTranslatingMsg = translating.has(msg.id);
            return (
              <div key={msg.id} className={`flex animate-message-in ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                    isMine ? "chat-bubble-sent rounded-br-md" : "chat-bubble-received rounded-bl-md"
                  }`}
                >
                  {isMine ? (
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  ) : (
                    <div className="text-sm prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                  {translateEnabled && (
                    <div className="mt-1.5 border-t border-current/10 pt-1.5">
                      {isTranslatingMsg ? (
                        <span className="flex items-center gap-1 text-xs opacity-60">
                          <Loader2 className="h-3 w-3 animate-spin" /> Translating...
                        </span>
                      ) : translated ? (
                        <p className="text-xs italic opacity-80">{translated}</p>
                      ) : null}
                    </div>
                  )}
                  <p className={`mt-1 text-[10px] ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {format(new Date(msg.created_at), "HH:mm")}
                  </p>
                </div>
              </div>
            );
          })
        )}
        {streaming && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl chat-bubble-received rounded-bl-md px-4 py-2.5 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        placeholder={`Message ${aiProfile.name}...`}
        disabled={streaming}
      />
    </div>
  );
};

export default AIChatView;
