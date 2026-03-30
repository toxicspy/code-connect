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
import TranslatedAudioButton from "./TranslatedAudioButton";
import MessageActionBar from "./MessageActionBar";
import TypingIndicator from "./TypingIndicator";
import AIProfileEditDialog from "./AIProfileEditDialog";

export interface AIProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  system_prompt: string | null;
}

const DEFAULT_AI_NAME = "Maya";
const DEFAULT_SYSTEM_PROMPT =
  "You are a friendly human-like girl chatting over text. Reply in short, natural sentences, sound warm and casual, understand shortcuts like wau and wru, and if asked where you live say London.";

interface AIChatViewProps {
  aiProfile: AIProfile | null;
  onBack?: () => void;
  onProfileUpdated?: (profile: AIProfile) => void;
}

const AIChatView = ({ aiProfile, onBack, onProfileUpdated }: AIChatViewProps) => {
  const { user } = useAuth();
  const { messages, loading, streaming, sendMessage, deleteMessages } = useAIChatMessages(aiProfile?.id ?? null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Selection state
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [showProfileEdit, setShowProfileEdit] = useState(false);

  // Translation state
  const [translateEnabled, setTranslateEnabled] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState("Kannada");
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<Set<string>>(new Set());
  const [failedTranslations, setFailedTranslations] = useState<Set<string>>(new Set());
  const [isRateLimited, setIsRateLimited] = useState(false);
  const processingRef = useRef(false);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming]);

  // Fetch starred AI messages
  useEffect(() => {
    if (!user || !aiProfile?.id) return;
    const fetchStarred = async () => {
      const msgIds = messages.map((m) => m.id);
      if (msgIds.length === 0) return;
      const { data } = await supabase
        .from("starred_messages")
        .select("ai_message_id")
        .eq("user_id", user.id)
        .in("ai_message_id", msgIds);
      setStarredIds(new Set(data?.map((d: any) => d.ai_message_id) || []));
    };
    fetchStarred();
  }, [user, aiProfile?.id, messages]);

  useEffect(() => { setSelectedMsgIds(new Set()); }, [aiProfile?.id]);

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
        if (responseError.includes("429") || responseError.toLowerCase().includes("rate limit")) { setIsRateLimited(true); toast.error("Too many translation requests."); return "rate_limited" as const; }
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

  const handleSend = async (text: string) => {
    if (streaming) return;
    try {
      const aiName = aiProfile?.name?.trim() || DEFAULT_AI_NAME;
      const identityPrompt = `Your name is ${aiName}. If the user asks your name, answer ${aiName}. If no profile name is saved, your default name is ${DEFAULT_AI_NAME}.`;
      await sendMessage(text, [identityPrompt, aiProfile?.system_prompt || DEFAULT_SYSTEM_PROMPT].filter(Boolean).join(" "));
    } catch (err: any) {
      toast.error(err.message || "Failed to get AI response");
    }
  };

  const selectedMessages = messages.filter((message) => selectedMsgIds.has(message.id));
  const primarySelectedMessage = selectedMessages[0];

  if (!aiProfile) {
    return (
      <div className="flex h-full flex-col items-center justify-center chat-area-bg">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-8 w-8 text-primary/40" />
        </div>
        <h3 className="mt-4 font-display text-lg font-semibold text-muted-foreground">Select or create an AI chat</h3>
        <p className="mt-1 text-sm text-muted-foreground/60">Create a custom AI assistant to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {selectedMessages.length > 0 ? (
        <MessageActionBar
          selectedMessageIds={selectedMessages.map((message) => message.id)}
          messageContent={primarySelectedMessage?.content ?? ""}
          selectedCount={selectedMessages.length}
          canCopy={selectedMessages.length === 1}
          canStar={selectedMessages.length === 1}
          isStarred={primarySelectedMessage ? starredIds.has(primarySelectedMessage.id) : false}
          chatType="ai"
          onDeselect={() => setSelectedMsgIds(new Set())}
          onDeleted={() => {
            setSelectedMsgIds(new Set());
          }}
          onDeleteMessages={deleteMessages}
          onStarToggled={() => {
            if (!primarySelectedMessage) return;
            setStarredIds((prev) => {
              const next = new Set(prev);
              if (next.has(primarySelectedMessage.id)) next.delete(primarySelectedMessage.id);
              else next.add(primarySelectedMessage.id);
              return next;
            });
            setSelectedMsgIds(new Set());
          }}
        />
      ) : (
        <div className="flex items-center gap-3 border-b chat-header-bg px-4 py-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 md:hidden">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-semibold text-primary overflow-hidden">
            <button
              onClick={() => setShowProfileEdit(true)}
              className="h-10 w-10 rounded-full overflow-hidden transition-opacity hover:opacity-80"
              title="Edit AI profile"
            >
              {aiProfile.avatar_url ? (
                <img src={aiProfile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Bot className="h-5 w-5" />
                </div>
              )}
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold">{aiProfile.name}</h3>
            <p className="text-xs text-muted-foreground">AI Assistant</p>
          </div>
          <TranslationSettings enabled={translateEnabled} targetLanguage={targetLanguage} onToggle={setTranslateEnabled} onLanguageChange={setTargetLanguage} />
        </div>
      )}

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto chat-area-bg px-4 py-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-8 text-sm text-muted-foreground">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bot className="h-12 w-12 text-primary/30 mb-3" />
            <p className="text-sm text-muted-foreground">Start chatting with {aiProfile.name}.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.role === "user";
            const translated = translations[msg.id];
            const isTranslatingMsg = translating.has(msg.id);
            const isSelected = selectedMsgIds.has(msg.id);
            return (
              <div
                key={msg.id}
                className={`flex animate-message-in ${isMine ? "justify-end" : "justify-start"}`}
                onClick={() => {
                  setSelectedMsgIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(msg.id)) next.delete(msg.id);
                    else next.add(msg.id);
                    return next;
                  });
                }}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm cursor-pointer transition-all ${
                    isMine ? "chat-bubble-sent rounded-br-md" : "chat-bubble-received rounded-bl-md"
                  } ${isSelected ? (isMine ? "chat-bubble-selected-sent scale-[1.02]" : "chat-bubble-selected-received scale-[1.02]") : ""}`}
                >
                  {isMine ? (
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  ) : (
                    <div className="text-sm prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                  {translateEnabled && (
                    <div className="mt-1.5 pt-1.5">
                      {isTranslatingMsg ? (
                        <span className="flex items-center gap-1 text-xs opacity-60">
                          <Loader2 className="h-3 w-3 animate-spin" /> Translating...
                        </span>
                      ) : translated ? (
                        <div className="flex items-center gap-1.5 rounded-lg bg-accent/40 px-2.5 py-1.5">
                          <p className="flex-1 text-xs font-bold text-accent-foreground">{translated}</p>
                          <TranslatedAudioButton text={translated} language={targetLanguage} />
                        </div>
                      ) : null}
                    </div>
                  )}
                  <p className={`mt-1 text-[10px] ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {format(new Date(msg.created_at), "HH:mm")}
                    {starredIds.has(msg.id) && " *"}
                  </p>
                </div>
              </div>
            );
          })
        )}
        {streaming && <TypingIndicator label={`${aiProfile.name} is typing`} />}
      </div>

      <ChatInput onSend={handleSend} placeholder={`Message ${aiProfile.name}...`} disabled={streaming} />

      <AIProfileEditDialog
        open={showProfileEdit}
        onOpenChange={setShowProfileEdit}
        profile={aiProfile}
        onUpdated={(profile) => {
          onProfileUpdated?.(profile);
        }}
      />
    </div>
  );
};

export default AIChatView;
