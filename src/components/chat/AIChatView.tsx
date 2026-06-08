import { useState, useRef, useEffect, useCallback, type ComponentType } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAIChatMessages } from "@/hooks/useAIChatMessages";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, Bot, SmilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";
import TranslationSettings from "./TranslationSettings";
import ChatInput from "./ChatInput";
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
const REACTION_OPTIONS = ["\u2764\uFE0F", "\u{1F602}", "\u{1F44D}", "\u{1F62E}", "\u{1F622}", "\u{1F525}"] as const;
const AI_UNAVAILABLE_MESSAGE = "The assistant is unavailable right now. Please try again in a little while.";

interface AIChatViewProps {
  aiProfile: AIProfile | null;
  onBack?: () => void;
  onProfileUpdated?: (profile: AIProfile) => void;
}

const AIChatView = ({ aiProfile, onBack, onProfileUpdated }: AIChatViewProps) => {
  const { user } = useAuth();
  const { messages, reactionsByMessage, loading, streaming, sendMessage, deleteMessages, toggleReaction } = useAIChatMessages(aiProfile?.id ?? null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const longPressTimeoutRef = useRef<number | null>(null);
  const reactionCloseTimeoutRef = useRef<number | null>(null);
  const [markdownRenderer, setMarkdownRenderer] = useState<ComponentType<{ children: string }> | null>(null);

  // Selection state
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [activeReactionPickerId, setActiveReactionPickerId] = useState<string | null>(null);
  const [reactionTooltipId, setReactionTooltipId] = useState<string | null>(null);

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

  useEffect(() => {
    let isMounted = true;

    const hasAssistantMessages = messages.some((message) => message.role !== "user");
    if (!hasAssistantMessages || markdownRenderer) return;

    import("react-markdown").then((module) => {
      if (isMounted) {
        setMarkdownRenderer(() => module.default);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [messages, markdownRenderer]);

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
    const handleCloseReactionPicker = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".message-bubble-wrap")) {
        return;
      }

      setActiveReactionPickerId(null);
      setReactionTooltipId(null);
    };

    if (activeReactionPickerId || reactionTooltipId) {
      document.addEventListener("pointerdown", handleCloseReactionPicker);
    }

    return () => {
      document.removeEventListener("pointerdown", handleCloseReactionPicker);
    };
  }, [activeReactionPickerId, reactionTooltipId]);

  useEffect(() => () => {
    if (reactionCloseTimeoutRef.current) {
      window.clearTimeout(reactionCloseTimeoutRef.current);
    }
  }, []);

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
        if (responseError.includes("429") || responseError.toLowerCase().includes("rate limit") || responseError.toLowerCase().includes("temporarily unavailable")) { setIsRateLimited(true); toast.error("Translation isn't available right now."); return "rate_limited" as const; }
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
    } catch {
      toast.error(AI_UNAVAILABLE_MESSAGE);
    }
  };

  const handleReactionToggle = async (messageId: string, emoji: string) => {
    const { error } = await toggleReaction(messageId, emoji);
    if (error) {
      toast.error(error.message || "Failed to update reaction");
      return;
    }
    setActiveReactionPickerId(null);
  };

  const handleTouchStart = (messageId: string) => {
    if (longPressTimeoutRef.current) {
      window.clearTimeout(longPressTimeoutRef.current);
    }

    longPressTimeoutRef.current = window.setTimeout(() => {
      setActiveReactionPickerId(messageId);
    }, 420);
  };

  const clearLongPress = () => {
    if (longPressTimeoutRef.current) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const openReactionPicker = (messageId: string) => {
    if (reactionCloseTimeoutRef.current) {
      window.clearTimeout(reactionCloseTimeoutRef.current);
      reactionCloseTimeoutRef.current = null;
    }
    setActiveReactionPickerId(messageId);
  };

  const scheduleReactionPickerClose = (messageId: string) => {
    if (reactionCloseTimeoutRef.current) {
      window.clearTimeout(reactionCloseTimeoutRef.current);
    }

    reactionCloseTimeoutRef.current = window.setTimeout(() => {
      setActiveReactionPickerId((current) => (current === messageId ? null : current));
      reactionCloseTimeoutRef.current = null;
    }, 180);
  };

  const selectedMessages = messages.filter((message) => selectedMsgIds.has(message.id));
  const primarySelectedMessage = selectedMessages[0];
  const MarkdownRenderer = markdownRenderer;

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
          canEdit={false}
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
        <div className="flex items-center gap-3 border-b border-border/70 chat-header-bg px-4 py-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 rounded-xl md:hidden">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-display text-sm font-semibold text-primary">
            <button
              onClick={() => setShowProfileEdit(true)}
              className="h-11 w-11 overflow-hidden rounded-full transition-opacity hover:opacity-80"
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

      <div ref={scrollRef} className="app-scroll-area flex-1 min-h-0 overflow-y-auto chat-area-bg px-4 py-4 space-y-2">
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
            const messageReactions = reactionsByMessage[msg.id] ?? [];
            const groupedReactions = Array.from(
              messageReactions.reduce((accumulator, reaction) => {
                const current = accumulator.get(reaction.emoji) ?? {
                  emoji: reaction.emoji,
                  count: 0,
                  reactedByMe: false,
                };
                current.count += 1;
                current.reactedByMe = current.reactedByMe || reaction.user_id === user?.id;
                accumulator.set(reaction.emoji, current);
                return accumulator;
              }, new Map<string, { emoji: string; count: number; reactedByMe: boolean }>()),
            ).map(([, value]) => value);
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
                  className="message-bubble-wrap relative max-w-[75%]"
                  onMouseEnter={() => openReactionPicker(msg.id)}
                  onMouseLeave={() => scheduleReactionPickerClose(msg.id)}
                  onTouchStart={() => handleTouchStart(msg.id)}
                  onTouchEnd={clearLongPress}
                  onTouchCancel={clearLongPress}
                >
                  {activeReactionPickerId === msg.id && (
                    <div
                      className={`reaction-picker ${isMine ? "reaction-picker-right" : "reaction-picker-left"}`}
                      onMouseEnter={() => openReactionPicker(msg.id)}
                      onMouseLeave={() => scheduleReactionPickerClose(msg.id)}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {REACTION_OPTIONS.map((emoji) => {
                        const reactedByMe = messageReactions.some((reaction) => reaction.user_id === user?.id && reaction.emoji === emoji);
                        return (
                          <button
                            key={emoji}
                            type="button"
                            className={`reaction-picker-option ${reactedByMe ? "reaction-picker-option-active reaction-bounce-in" : ""}`}
                            onClick={() => void handleReactionToggle(msg.id, emoji)}
                          >
                            <span>{emoji}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div
                    className={`max-w-full rounded-2xl px-4 py-2.5 shadow-sm cursor-pointer transition-all ${
                      isMine ? "chat-bubble-sent rounded-br-md" : "chat-bubble-received rounded-bl-md"
                    } ${isSelected ? (isMine ? "chat-bubble-selected-sent scale-[1.02]" : "chat-bubble-selected-received scale-[1.02]") : ""}`}
                  >
                    {isMine ? (
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    ) : (
                      <div className="text-sm prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        {MarkdownRenderer ? (
                          <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                        ) : (
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        )}
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

                  <button
                    type="button"
                    className={`reaction-trigger ${isMine ? "reaction-trigger-right" : "reaction-trigger-left"}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (activeReactionPickerId === msg.id) {
                        scheduleReactionPickerClose(msg.id);
                      } else {
                        openReactionPicker(msg.id);
                      }
                    }}
                  >
                    <SmilePlus className="h-3.5 w-3.5" />
                  </button>

                  {groupedReactions.length > 0 && (
                    <div className={`reaction-summary ${isMine ? "justify-end" : "justify-start"}`}>
                      {groupedReactions.map((reaction) => {
                        const reactedUsers = messageReactions.filter((entry) => entry.emoji === reaction.emoji);
                        return (
                          <div key={`${msg.id}-${reaction.emoji}`} className="relative">
                            <button
                              type="button"
                              className={`reaction-chip ${reaction.reactedByMe ? "reaction-chip-active reaction-bounce-in" : ""}`}
                              onMouseEnter={() => setReactionTooltipId(`${msg.id}-${reaction.emoji}`)}
                              onMouseLeave={() => setReactionTooltipId((current) => (current === `${msg.id}-${reaction.emoji}` ? null : current))}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleReactionToggle(msg.id, reaction.emoji);
                              }}
                            >
                              <span>{reaction.emoji}</span>
                              {reaction.count > 1 && <span className="text-[10px] font-semibold">{reaction.count}</span>}
                            </button>
                            {reactionTooltipId === `${msg.id}-${reaction.emoji}` && (
                              <div className="reaction-tooltip">
                                {reactedUsers.map((entry) => (
                                  <div key={entry.id} className="reaction-tooltip-line">
                                    {entry.user_id === user?.id ? "You" : aiProfile.name} reacted with {entry.emoji}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
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
