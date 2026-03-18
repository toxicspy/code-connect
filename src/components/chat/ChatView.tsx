import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMessages } from "@/hooks/useMessages";
import { ConversationWithDetails } from "@/hooks/useConversations";
import { supabase } from "@/integrations/supabase/client";
import { Send, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";
import TranslationSettings from "./TranslationSettings";
import ChatInput from "./ChatInput";

interface ChatViewProps {
  conversation: ConversationWithDetails | null;
  onBack?: () => void;
}

const ChatView = ({ conversation, onBack }: ChatViewProps) => {
  const { user } = useAuth();
  const { messages, loading, sendMessage } = useMessages(conversation?.id ?? null);
  const scrollRef = useRef<HTMLDivElement>(null);
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

  // Reset translations when conversation/language changes or translation is toggled off
  useEffect(() => {
    setTranslations({});
    setTranslating(new Set());
    setFailedTranslations(new Set());
    setIsRateLimited(false);
    processingRef.current = false;
  }, [conversation?.id, translateEnabled, targetLanguage]);

  const translateText = useCallback(async (msgId: string, text: string) => {
    if (translations[msgId] || translating.has(msgId) || failedTranslations.has(msgId)) {
      return "skip" as const;
    }

    setTranslating((prev) => new Set(prev).add(msgId));
    try {
      const { data, error } = await supabase.functions.invoke("translate", {
        body: { text, targetLanguage },
      });

      const responseError = error?.message || data?.error;
      if (responseError) {
        const is429 = responseError.includes("429") || responseError.toLowerCase().includes("rate limit");
        if (is429) {
          setIsRateLimited(true);
          toast.error("Too many translation requests. Please wait a moment and toggle translate on again.");
          return "rate_limited" as const;
        }
        setFailedTranslations((prev) => new Set(prev).add(msgId));
        return "failed" as const;
      }

      setTranslations((prev) => ({ ...prev, [msgId]: data.translated }));
      return "ok" as const;
    } catch (e: any) {
      const msg = String(e?.message || "");
      const is429 = msg.includes("429") || msg.toLowerCase().includes("rate limit");
      if (is429) {
        setIsRateLimited(true);
        toast.error("Too many translation requests. Please wait a moment and toggle translate on again.");
        return "rate_limited" as const;
      }
      setFailedTranslations((prev) => new Set(prev).add(msgId));
      return "failed" as const;
    } finally {
      setTranslating((prev) => {
        const next = new Set(prev);
        next.delete(msgId);
        return next;
      });
    }
  }, [targetLanguage, translations, translating, failedTranslations]);

  // Translate messages sequentially with throttling (single queue worker)
  useEffect(() => {
    if (!translateEnabled || !targetLanguage || messages.length === 0 || isRateLimited) return;
    if (processingRef.current) return;

    const untranslated = messages.filter(
      (msg) => !translations[msg.id] && !translating.has(msg.id) && !failedTranslations.has(msg.id)
    );
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

    processQueue()
      .catch((err) => {
        console.error("Translation queue failed:", err);
      })
      .finally(() => {
        processingRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [translateEnabled, targetLanguage, messages, translations, translating, failedTranslations, isRateLimited, translateText]);

  const handleSend = async (text: string) => {
    await sendMessage(text);
  };

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center chat-area-bg">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Send className="h-8 w-8 text-primary/40" />
        </div>
        <h3 className="mt-4 font-display text-lg font-semibold text-muted-foreground">
          Select a chat to start messaging
        </h3>
        <p className="mt-1 text-sm text-muted-foreground/60">
          Or add a new contact using their unique code
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
          {conversation.otherUser.avatar_url ? (
            <img src={conversation.otherUser.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            conversation.otherUser.display_name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">{conversation.otherUser.display_name}</h3>
          <p className="text-xs font-mono user-code-badge inline-block rounded px-1.5 py-0.5">
            #{conversation.otherUser.user_code}
          </p>
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
          <div className="flex justify-center py-8 text-sm text-muted-foreground">
            No messages yet. Say hello! 👋
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === user?.id;
            const translated = translations[msg.id];
            const isTranslating = translating.has(msg.id);
            return (
              <div
                key={msg.id}
                className={`flex animate-message-in ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                    isMine
                      ? "chat-bubble-sent rounded-br-md"
                      : "chat-bubble-received rounded-bl-md"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  {translateEnabled && (
                    <div className="mt-1.5 border-t border-current/10 pt-1.5">
                      {isTranslating ? (
                        <span className="flex items-center gap-1 text-xs opacity-60">
                          <Loader2 className="h-3 w-3 animate-spin" /> Translating...
                        </span>
                      ) : translated ? (
                        <p className="text-xs italic opacity-80">{translated}</p>
                      ) : null}
                    </div>
                  )}
                  <p
                    className={`mt-1 text-[10px] ${
                      isMine ? "text-primary-foreground/60" : "text-muted-foreground"
                    }`}
                  >
                    {format(new Date(msg.created_at), "HH:mm")}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="border-t chat-input-bg px-4 py-3">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 bg-muted border-0"
          />
          <Button onClick={handleSend} disabled={!input.trim()} size="icon" className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
