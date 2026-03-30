import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMessages, type ChatMessage } from "@/hooks/useMessages";
import { ConversationWithDetails } from "@/hooks/useConversations";
import { supabase } from "@/integrations/supabase/client";
import { useCall } from "@/contexts/CallContext";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Send, ArrowLeft, Loader2, Check, CheckCheck, Phone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";
import TranslationSettings from "./TranslationSettings";
import ChatInput from "./ChatInput";
import TranslatedAudioButton from "./TranslatedAudioButton";
import MessageActionBar from "./MessageActionBar";
import TypingIndicator from "./TypingIndicator";

interface ChatViewProps {
  conversation: ConversationWithDetails | null;
  onBack?: () => void;
}

const GREETING_MESSAGE = "Hi 🙂";

const MessageStatus = ({ message }: { message: ChatMessage }) => {
  if (message.clientStatus === "sending") {
    return <Check className="h-3 w-3" aria-label="Sent" />;
  }

  if (message.read_at) {
    return <CheckCheck className="h-3 w-3 text-sky-300" aria-label="Seen" />;
  }

  return <CheckCheck className="h-3 w-3" aria-label="Delivered" />;
};

const ChatView = ({ conversation, onBack }: ChatViewProps) => {
  const { user } = useAuth();
  const { startCall, activeCall, incomingCall } = useCall();
  const { messages, loading, sendMessage, editMessage, deleteMessages } = useMessages(conversation?.id ?? null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [draftValue, setDraftValue] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const [translateEnabled, setTranslateEnabled] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState("Kannada");
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<Set<string>>(new Set());
  const [failedTranslations, setFailedTranslations] = useState<Set<string>>(new Set());
  const [isRateLimited, setIsRateLimited] = useState(false);
  const processingRef = useRef(false);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOtherUserTyping]);

  useEffect(() => {
    if (!user || !conversation?.id) return;
    const fetchStarred = async () => {
      const msgIds = messages.map((m) => m.id);
      if (msgIds.length === 0) return;
      const { data } = await supabase
        .from("starred_messages")
        .select("message_id")
        .eq("user_id", user.id)
        .in("message_id", msgIds);
      setStarredIds(new Set(data?.map((d: { message_id: string | null }) => d.message_id ?? "").filter(Boolean) || []));
    };
    fetchStarred();
  }, [user, conversation?.id, messages]);

  useEffect(() => {
    setSelectedMsgIds(new Set());
    setDraftValue("");
    setEditingMessageId(null);
  }, [conversation?.id]);

  useEffect(() => {
    setIsOtherUserTyping(false);
  }, [conversation?.id]);

  useEffect(() => {
    if (!conversation?.id || !user) return;

    const channel = supabase
      .channel(`typing-${conversation.id}`, {
        config: {
          broadcast: { self: false },
        },
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.userId === user.id) return;
        setIsOtherUserTyping(Boolean(payload.isTyping));
      })
      .subscribe();

    typingChannelRef.current = channel;

    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      typingChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [conversation?.id, user]);

  useEffect(() => {
    setTranslations({});
    setTranslating(new Set());
    setFailedTranslations(new Set());
    setIsRateLimited(false);
    processingRef.current = false;
  }, [conversation?.id, translateEnabled, targetLanguage]);

  const translateText = useCallback(async (msgId: string, text: string) => {
    if (translations[msgId] || translating.has(msgId) || failedTranslations.has(msgId)) return "skip" as const;
    setTranslating((prev) => new Set(prev).add(msgId));
    try {
      const { data, error } = await supabase.functions.invoke("translate", { body: { text, targetLanguage } });
      const responseError = error?.message || data?.error;
      if (responseError) {
        const is429 = responseError.includes("429") || responseError.toLowerCase().includes("rate limit");
        if (is429) {
          setIsRateLimited(true);
          toast.error("Too many translation requests.");
          return "rate_limited" as const;
        }
        setFailedTranslations((prev) => new Set(prev).add(msgId));
        return "failed" as const;
      }
      setTranslations((prev) => ({ ...prev, [msgId]: data.translated }));
      return "ok" as const;
    } catch (e: unknown) {
      const msg = String((e as { message?: string })?.message || "");
      if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
        setIsRateLimited(true);
        toast.error("Too many translation requests.");
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

  useEffect(() => {
    if (!translateEnabled || !targetLanguage || messages.length === 0 || isRateLimited) return;
    if (processingRef.current) return;
    const untranslated = messages.filter((msg) => !translations[msg.id] && !translating.has(msg.id) && !failedTranslations.has(msg.id));
    if (untranslated.length === 0) return;
    let cancelled = false;
    processingRef.current = true;
    const processQueue = async () => {
      for (const msg of untranslated) {
        if (cancelled) break;
        const result = await translateText(msg.id, msg.content);
        if (result === "rate_limited") break;
        if (!cancelled) await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    };
    processQueue().catch(console.error).finally(() => {
      processingRef.current = false;
    });
    return () => {
      cancelled = true;
    };
  }, [translateEnabled, targetLanguage, messages, translations, translating, failedTranslations, isRateLimited, translateText]);

  const handleSend = async (text: string) => {
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    typingChannelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user?.id, isTyping: false },
    });

    if (editingMessageId) {
      const { error } = await editMessage(editingMessageId, text);
      if (error) {
        toast.error("Failed to edit message");
        return;
      }
      toast.success("Message updated");
      setEditingMessageId(null);
      setDraftValue("");
      return;
    }

    await sendMessage(text);
    setDraftValue("");
  };

  const handleDraftChange = useCallback((text: string) => {
    if (!user || !typingChannelRef.current) return;

    const isTyping = text.trim().length > 0;
    typingChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user.id, isTyping },
    });

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (isTyping) {
      typingTimeoutRef.current = window.setTimeout(() => {
        typingChannelRef.current?.send({
          type: "broadcast",
          event: "typing",
          payload: { userId: user.id, isTyping: false },
        });
        typingTimeoutRef.current = null;
      }, 1500);
    }
  }, [user]);

  const selectedMessages = messages.filter((message) => selectedMsgIds.has(message.id));
  const selectedMessageIds = Array.from(selectedMsgIds);
  const primarySelectedMessage = selectedMessages[0];
  const canEditSelectedMessage = selectedMessages.length === 1 && primarySelectedMessage?.sender_id === user?.id;
  const callDisabled = Boolean(activeCall || incomingCall);

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center chat-area-bg">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Send className="h-8 w-8 text-primary/40" />
        </div>
        <h3 className="mt-4 font-display text-lg font-semibold text-muted-foreground">Select a chat to start messaging</h3>
        <p className="mt-1 text-sm text-muted-foreground/60">Or add a new contact using their unique code</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {selectedMessages.length > 0 ? (
        <MessageActionBar
          selectedMessageIds={selectedMessageIds}
          messageContent={primarySelectedMessage?.content ?? ""}
          selectedCount={selectedMessages.length}
          canCopy={selectedMessages.length === 1}
          canStar={selectedMessages.length === 1}
          canEdit={canEditSelectedMessage}
          isStarred={primarySelectedMessage ? starredIds.has(primarySelectedMessage.id) : false}
          chatType="normal"
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
          onEditRequested={() => {
            if (!primarySelectedMessage || primarySelectedMessage.sender_id !== user?.id) return;
            setEditingMessageId(primarySelectedMessage.id);
            setDraftValue(primarySelectedMessage.content);
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
            {conversation.otherUser.avatar_url ? (
              <img src={conversation.otherUser.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              conversation.otherUser.display_name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold">{conversation.otherUser.display_name}</h3>
            <p className="text-xs font-mono user-code-badge inline-block rounded px-1.5 py-0.5">#{conversation.otherUser.user_code}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            title="Start voice call"
            disabled={callDisabled}
            onClick={() => startCall({
              targetUserId: conversation.otherUser.user_id,
              targetName: conversation.otherUser.display_name,
              callType: "voice",
            })}
          >
            <Phone className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            title="Start video call"
            disabled={callDisabled}
            onClick={() => startCall({
              targetUserId: conversation.otherUser.user_id,
              targetName: conversation.otherUser.display_name,
              callType: "video",
            })}
          >
            <Video className="h-4 w-4" />
          </Button>
          <TranslationSettings enabled={translateEnabled} targetLanguage={targetLanguage} onToggle={setTranslateEnabled} onLanguageChange={setTargetLanguage} />
        </div>
      )}

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto chat-area-bg px-4 py-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-8 text-sm text-muted-foreground">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm text-muted-foreground">No messages yet. Start with a friendly hello.</p>
            <Button type="button" className="mt-4 rounded-full px-5" onClick={() => void handleSend(GREETING_MESSAGE)}>
              Say Hi
            </Button>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === user?.id;
            const translated = translations[msg.id];
            const isTranslating = translating.has(msg.id);
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
                  className={`max-w-[75%] cursor-pointer rounded-2xl px-4 py-2.5 shadow-sm transition-all ${
                    isMine ? "chat-bubble-sent rounded-br-md" : "chat-bubble-received rounded-bl-md"
                  } ${isSelected ? (isMine ? "chat-bubble-selected-sent scale-[1.02]" : "chat-bubble-selected-received scale-[1.02]") : ""}`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  {translateEnabled && (
                    <div className="mt-1.5 pt-1.5">
                      {isTranslating ? (
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
                  <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    <span>{format(new Date(msg.created_at), "HH:mm")}</span>
                    {starredIds.has(msg.id) && <span>*</span>}
                    {isMine && <MessageStatus message={msg} />}
                  </div>
                </div>
              </div>
            );
          })
        )}
        {isOtherUserTyping && <TypingIndicator label={`${conversation.otherUser.display_name} is typing`} />}
      </div>

      <ChatInput
        onSend={handleSend}
        onDraftChange={handleDraftChange}
        value={draftValue}
        onValueChange={setDraftValue}
        isEditing={Boolean(editingMessageId)}
        onCancelEdit={() => {
          setEditingMessageId(null);
          setDraftValue("");
        }}
        placeholder={editingMessageId ? "Edit your message..." : "Type a message..."}
      />
    </div>
  );
};

export default ChatView;
