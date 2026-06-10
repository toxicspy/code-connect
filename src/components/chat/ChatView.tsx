import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMessages, type ChatMessage } from "@/hooks/useMessages";
import { ConversationWithDetails } from "@/hooks/useConversations";
import { generateUUID } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCall } from "@/contexts/CallContext";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Send, ArrowLeft, Loader2, Check, CheckCheck, Phone, Video, Gift, Sparkles, Download, FileText, ImageIcon, Film, Lock, SmilePlus, Reply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";
import TranslationSettings from "./TranslationSettings";
import ChatInput from "./ChatInput";
import TranslatedAudioButton from "./TranslatedAudioButton";
import MessageActionBar from "./MessageActionBar";
import TypingIndicator from "./TypingIndicator";
import TreasureBoxRevealDialog from "./TreasureBoxRevealDialog";
import { TREASURE_MESSAGE_TYPE, getMessagePreview, getMessageTypeLabel } from "@/lib/message-utils";
import EncryptionDialog from "./EncryptionDialog";
import { clearConversationPassphrase, getConversationPassphrase, isConversationEncrypted, setConversationPassphrase as persistConversationPassphrase } from "@/lib/chat-encryption";
import UserProfilePanel from "./UserProfilePanel";
import { sanitizeDisplayName } from "@/lib/profile-utils";
import { EmptyChatsState } from "./EmptyChatsState";

interface ChatViewProps {
  conversation: ConversationWithDetails | null;
  onBack?: () => void;
  onSendChatRequest?: () => void;
  onViewRequests?: () => void;
}

interface ReplyDraft {
  id: string;
  senderId: string;
  senderName: string;
  preview: string;
  messageType: string;
}

const GREETING_MESSAGE = "Hi :)";
const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
const REACTION_OPTIONS = ["\u2764\uFE0F", "\u{1F602}", "\u{1F44D}", "\u{1F62E}", "\u{1F622}", "\u{1F525}"] as const;

const normalizeLink = (value: string) => (
  value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`
);

const MessageStatus = ({ message }: { message: ChatMessage }) => {
  if (message.clientStatus === "sending") {
    return <Check className="h-3 w-3" aria-label="Sent" />;
  }

  if (message.read_at) {
    return <CheckCheck className="h-3 w-3 text-sky-300" aria-label="Seen" />;
  }

  return <CheckCheck className="h-3 w-3" aria-label="Delivered" />;
};

const renderMessageContent = (content: string) => {
  const matches = Array.from(content.matchAll(linkRegex));
  if (matches.length === 0) {
    return <p className="text-sm whitespace-pre-wrap break-words">{content}</p>;
  }

  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  matches.forEach((match, index) => {
    const rawLink = match[0];
    const start = match.index ?? 0;

    if (start > lastIndex) {
      nodes.push(
        <span key={`text-${index}`} className="whitespace-pre-wrap break-words">
          {content.slice(lastIndex, start)}
        </span>,
      );
    }

    nodes.push(
      <a
        key={`link-${index}`}
        href={normalizeLink(rawLink)}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
        className="break-all font-medium underline underline-offset-4 transition-opacity hover:opacity-80"
      >
        {rawLink}
      </a>,
    );

    lastIndex = start + rawLink.length;
  });

  if (lastIndex < content.length) {
    nodes.push(
      <span key="text-tail" className="whitespace-pre-wrap break-words">
        {content.slice(lastIndex)}
      </span>,
    );
  }

  return <p className="text-sm whitespace-pre-wrap break-words">{nodes}</p>;
};

const ChatView = ({ conversation, onBack, onSendChatRequest, onViewRequests }: ChatViewProps) => {
  const { user } = useAuth();
  const { startCall, activeCall, incomingCall } = useCall();
  const { messages, reactionsByMessage, loading, sendMessage, sendTreasureMessage, openTreasureMessage, editMessage, deleteMessages, toggleReaction } = useMessages(conversation?.id ?? null, conversation?.otherUser.user_id ?? null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const longPressTimeoutRef = useRef<number | null>(null);
  const reactionCloseTimeoutRef = useRef<number | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [draftValue, setDraftValue] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [activeTreasureMessageId, setActiveTreasureMessageId] = useState<string | null>(null);
  const [encryptionDialogOpen, setEncryptionDialogOpen] = useState(false);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [activeReactionPickerId, setActiveReactionPickerId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ReplyDraft | null>(null);
  const [highlightedReplyId, setHighlightedReplyId] = useState<string | null>(null);
  const [conversationEncrypted, setConversationEncrypted] = useState(false);
  const [conversationPassphrase, setConversationPassphraseValue] = useState("");
  const [iBlockedUser, setIBlockedUser] = useState(false);
  const [blockedByUser, setBlockedByUser] = useState(false);

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
    setActiveTreasureMessageId(null);
    setProfilePanelOpen(false);
    setReplyingTo(null);
    if (conversation?.id) {
      setConversationEncrypted(isConversationEncrypted(conversation.id));
      setConversationPassphraseValue(getConversationPassphrase(conversation.id) ?? "");
    } else {
      setConversationEncrypted(false);
      setConversationPassphraseValue("");
    }
  }, [conversation?.id]);

  useEffect(() => {
    if (!user?.id || !conversation?.otherUser.user_id) {
      setIBlockedUser(false);
      setBlockedByUser(false);
      return;
    }

    let cancelled = false;

    const fetchBlockState = async () => {
      const [{ data: myBlock }, { data: theirBlock }] = await Promise.all([
        supabase
          .from("blocked_users")
          .select("id")
          .eq("blocker_user_id", user.id)
          .eq("blocked_user_id", conversation.otherUser.user_id)
          .maybeSingle(),
        supabase
          .from("blocked_users")
          .select("id")
          .eq("blocker_user_id", conversation.otherUser.user_id)
          .eq("blocked_user_id", user.id)
          .maybeSingle(),
      ]);

      if (!cancelled) {
        setIBlockedUser(Boolean(myBlock));
        setBlockedByUser(Boolean(theirBlock));
      }
    };

    void fetchBlockState();

    return () => {
      cancelled = true;
    };
  }, [conversation?.otherUser.user_id, user?.id]);

  useEffect(() => {
    setIsOtherUserTyping(false);
  }, [conversation?.id]);

  useEffect(() => {
    const handleCloseReactionPicker = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".message-bubble-wrap")) {
        return;
      }

      setActiveReactionPickerId(null);
    };

    if (activeReactionPickerId) {
      document.addEventListener("pointerdown", handleCloseReactionPicker);
    }

    return () => {
      document.removeEventListener("pointerdown", handleCloseReactionPicker);
    };
  }, [activeReactionPickerId]);

  useEffect(() => () => {
    if (reactionCloseTimeoutRef.current) {
      window.clearTimeout(reactionCloseTimeoutRef.current);
    }
  }, []);

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
        if (is429 || responseError.toLowerCase().includes("temporarily unavailable")) {
          setIsRateLimited(true);
          toast.error("Translation isn't available right now.");
          return "rate_limited" as const;
        }
        setFailedTranslations((prev) => new Set(prev).add(msgId));
        return "failed" as const;
      }
      setTranslations((prev) => ({ ...prev, [msgId]: data.translated }));
      return "ok" as const;
    } catch (e: unknown) {
      const msg = String((e as { message?: string })?.message || "");
      if (msg.includes("429") || msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("temporarily unavailable")) {
        setIsRateLimited(true);
        toast.error("Translation isn't available right now.");
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

    const { error } = await sendMessage(text, replyingTo ? {
      repliedMessageId: replyingTo.id,
      repliedMessageContent: replyingTo.preview,
      repliedUserId: replyingTo.senderId,
      repliedMessageType: replyingTo.messageType,
    } : undefined);
    if (error) {
      toast.error(error.message || "Failed to send message");
      return;
    }
    setDraftValue("");
    setReplyingTo(null);
  };

  const handleSendAttachment = useCallback(async (file: File) => {
    if (!user || !conversation?.id) {
      throw new Error("Open a chat before sending an attachment");
    }

    if (blockedByUser) {
      throw new Error("This user has blocked you. Your message was not sent.");
    }

    if (iBlockedUser) {
      throw new Error("You blocked this user. Unblock them to send attachments.");
    }

    const maxSizeMb = 15;
    if (file.size > maxSizeMb * 1024 * 1024) {
      throw new Error(`Please choose a file under ${maxSizeMb} MB`);
    }

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
    const extension = sanitizedName.includes(".") ? sanitizedName.slice(sanitizedName.lastIndexOf(".")) : "";
    const baseName = extension ? sanitizedName.slice(0, -extension.length) : sanitizedName;
    const storagePath = `${user.id}/${baseName}-${generateUUID()}${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("chat-media")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadError) {
      throw new Error(uploadError.message || "Failed to upload attachment");
    }

    const { data: publicUrlData } = supabase.storage.from("chat-media").getPublicUrl(storagePath);
    const { error } = await sendMessage(file.name, {
      mediaUrl: publicUrlData.publicUrl,
      mediaType: file.type || "application/octet-stream",
      fileName: file.name,
    });

    if (error) {
      throw error;
    }
  }, [blockedByUser, conversation?.id, iBlockedUser, sendMessage, user]);

  const handleDraftChange = useCallback((text: string) => {
    if (!user || !typingChannelRef.current || blockedByUser || iBlockedUser) return;

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
  }, [blockedByUser, iBlockedUser, user]);

  const selectedMessages = messages.filter((message) => selectedMsgIds.has(message.id));
  const selectedMessageIds = Array.from(selectedMsgIds);
  const primarySelectedMessage = selectedMessages[0];
  const canEditSelectedMessage =
    selectedMessages.length === 1 &&
    primarySelectedMessage?.sender_id === user?.id &&
    primarySelectedMessage?.message_type !== TREASURE_MESSAGE_TYPE;
  const callDisabled = Boolean(activeCall || incomingCall || iBlockedUser || blockedByUser);
  const activeTreasureMessage =
    messages.find((message) => message.id === activeTreasureMessageId && message.message_type === TREASURE_MESSAGE_TYPE) ?? null;

  const handleOpenTreasure = async (message: ChatMessage) => {
    setActiveTreasureMessageId(message.id);
    if (!message.is_opened) {
      const { error } = await openTreasureMessage(message.id);
      if (error) {
        toast.error("Failed to open treasure box");
      }
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

  const jumpToMessage = (messageId: string | null) => {
    if (!messageId) return;
    const target = messageRefs.current[messageId];
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedReplyId(messageId);
    window.setTimeout(() => {
      setHighlightedReplyId((current) => (current === messageId ? null : current));
    }, 1600);
  };

  const beginReply = (message: ChatMessage) => {
    const senderName = message.sender_id === user?.id
      ? "You"
      : sanitizeDisplayName(conversation?.otherUser.display_name ?? "User");

    setReplyingTo({
      id: message.id,
      senderId: message.sender_id,
      senderName,
      preview: getMessagePreview(message),
      messageType: getMessageTypeLabel(message),
    });
    setSelectedMsgIds(new Set());
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

  if (!conversation) {
    return (
      <EmptyChatsState
        onSendChatRequest={onSendChatRequest}
        onViewRequests={onViewRequests}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {selectedMessages.length > 0 ? (
        <MessageActionBar
          selectedMessageIds={selectedMessageIds}
          messageContent={primarySelectedMessage?.content ?? ""}
          selectedCount={selectedMessages.length}
          canCopy={selectedMessages.length === 1 && primarySelectedMessage?.message_type !== TREASURE_MESSAGE_TYPE}
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
        <div className="flex items-center gap-3 border-b border-border/70 chat-header-bg px-4 py-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 rounded-xl md:hidden">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <button
            type="button"
            onClick={() => setProfilePanelOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-1 py-1 text-left transition-colors hover:bg-accent/40"
            title="Open contact info"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-display text-sm font-semibold text-primary">
              {conversation.otherUser.avatar_url ? (
                <img src={conversation.otherUser.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                sanitizeDisplayName(conversation.otherUser.display_name).charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">{sanitizeDisplayName(conversation.otherUser.display_name)}</h3>
            </div>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-2xl"
            title="Start voice call"
            disabled={callDisabled}
            onClick={() => startCall({
              targetUserId: conversation.otherUser.user_id,
              targetName: sanitizeDisplayName(conversation.otherUser.display_name),
              callType: "voice",
            })}
          >
            <Phone className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-2xl"
            title="Start video call"
            disabled={callDisabled}
            onClick={() => startCall({
              targetUserId: conversation.otherUser.user_id,
              targetName: sanitizeDisplayName(conversation.otherUser.display_name),
              callType: "video",
            })}
          >
            <Video className="h-4 w-4" />
          </Button>
          <TranslationSettings enabled={translateEnabled} targetLanguage={targetLanguage} onToggle={setTranslateEnabled} onLanguageChange={setTargetLanguage} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={`h-10 w-10 shrink-0 rounded-2xl ${conversationEncrypted ? "text-emerald-500" : ""}`}
            title={conversationEncrypted ? "Manage end-to-end encryption" : "Enable end-to-end encryption"}
            onClick={() => setEncryptionDialogOpen(true)}
          >
            <Lock className="h-4 w-4" />
          </Button>
        </div>
      )}

      {iBlockedUser && (
        <div className="border-b border-amber-500/25 bg-amber-500/12 px-4 py-2.5 text-sm text-amber-900 dark:text-amber-200">
          You blocked this user.
        </div>
      )}

      <div ref={scrollRef} className="app-scroll-area flex-1 min-h-0 overflow-y-auto chat-area-bg px-4 py-5 space-y-3">
        {loading ? (
          <div className="flex justify-center py-8 text-sm text-muted-foreground">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-primary/10 text-primary">
              <Send className="h-6 w-6" />
            </div>
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
            const isTreasure = msg.message_type === TREASURE_MESSAGE_TYPE;
            const hasMedia = Boolean(msg.media_url);
            const isImage = msg.media_type?.startsWith("image/");
            const isVideo = msg.media_type?.startsWith("video/");
            const showTextContent = Boolean(msg.content && msg.content !== msg.file_name);
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
                ref={(node) => {
                  messageRefs.current[msg.id] = node;
                }}
                className={`flex animate-message-in rounded-2xl px-2 py-1.5 transition-colors duration-200 ${isMine ? "justify-end" : "justify-start"} ${isSelected ? "message-row-selected" : ""} ${highlightedReplyId === msg.id ? "message-reply-highlight" : ""}`}
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
                            className={`reaction-picker-option ${reactedByMe ? "reaction-picker-option-active" : ""}`}
                            onClick={() => void handleReactionToggle(msg.id, emoji)}
                          >
                            <span>{emoji}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div
                    className={`max-w-full cursor-pointer rounded-2xl px-4 py-2.5 shadow-sm transition-all duration-200 ${
                      isTreasure
                        ? "treasure-box-bubble"
                        : isMine
                          ? "chat-bubble-sent rounded-br-md"
                          : "chat-bubble-received rounded-bl-md"
                    } ${isSelected ? (isMine ? "chat-bubble-selected-sent message-bubble-selected scale-[1.02]" : "chat-bubble-selected-received message-bubble-selected scale-[1.02]") : ""}`}
                  >
                    {msg.replied_message_id && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          jumpToMessage(msg.replied_message_id);
                        }}
                        className="message-reply-preview mb-2 flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left"
                      >
                        <div className="message-reply-bar" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-semibold text-primary">
                            {msg.replied_user_id === user?.id ? "You" : sanitizeDisplayName(conversation.otherUser.display_name)}
                          </div>
                          <div className="truncate text-xs opacity-80">
                            {msg.replied_message_content || "Original message unavailable"}
                          </div>
                        </div>
                      </button>
                    )}
                    {isTreasure ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleOpenTreasure(msg);
                        }}
                        className="treasure-box-trigger group flex w-full items-center gap-3 text-left"
                      >
                        <div className="treasure-box-icon-wrap">
                          <Gift className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="treasure-box-title text-sm font-semibold">Treasure Box - tap to open</p>
                          <p className="treasure-box-subtitle mt-1 text-xs">
                            {msg.is_opened ? "Opened treasure box" : "A styled secret message is waiting inside"}
                          </p>
                        </div>
                        <Sparkles className="treasure-box-spark h-4 w-4 shrink-0" />
                      </button>
                    ) : hasMedia ? (
                      <div className="space-y-2">
                        {isImage ? (
                          <a href={msg.media_url || "#"} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl">
                            <img
                              src={msg.media_url || ""}
                              alt={msg.file_name || "Shared image"}
                              className="max-h-80 w-full rounded-2xl object-cover"
                              loading="lazy"
                            />
                          </a>
                        ) : isVideo ? (
                          <video
                            controls
                            preload="metadata"
                            className="max-h-80 w-full rounded-2xl bg-black/90"
                            src={msg.media_url || undefined}
                          />
                        ) : null}

                        {!isImage && !isVideo && (
                          <a
                            href={msg.media_url || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/70 px-3 py-3 text-sm transition-colors hover:bg-background"
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{msg.file_name || "Attachment"}</p>
                              <p className="text-xs text-muted-foreground">Tap to open or download</p>
                            </div>
                            <Download className="h-4 w-4 shrink-0 opacity-70" />
                          </a>
                        )}

                        <div className="flex items-center gap-2 text-xs opacity-80">
                          {isImage ? <ImageIcon className="h-3.5 w-3.5" /> : isVideo ? <Film className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                          <span className="truncate">{msg.file_name || msg.content}</span>
                        </div>

                        {showTextContent && renderMessageContent(msg.content)}
                      </div>
                    ) : (
                      renderMessageContent(msg.content)
                    )}
                    {translateEnabled && !isTreasure && !hasMedia && !msg.is_encrypted && (
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

                  <button
                    type="button"
                    className={`reply-trigger ${isMine ? "reply-trigger-right" : "reply-trigger-left"}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      beginReply(msg);
                    }}
                  >
                    <Reply className="h-3.5 w-3.5" />
                  </button>

                  {groupedReactions.length > 0 && (
                    <div className={`reaction-summary ${isMine ? "justify-end" : "justify-start"}`}>
                      {groupedReactions.map((reaction) => (
                        <button
                          key={`${msg.id}-${reaction.emoji}`}
                          type="button"
                          className={`reaction-chip ${reaction.reactedByMe ? "reaction-chip-active" : ""}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleReactionToggle(msg.id, reaction.emoji);
                          }}
                        >
                          <span>{reaction.emoji}</span>
                          {reaction.count > 1 && <span className="text-[10px] font-semibold">{reaction.count}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        {isOtherUserTyping && <TypingIndicator label={`${sanitizeDisplayName(conversation.otherUser.display_name)} is typing`} />}
      </div>

      <ChatInput
        onSend={handleSend}
        onSendAttachment={handleSendAttachment}
        onDraftChange={handleDraftChange}
        value={draftValue}
        onValueChange={setDraftValue}
        isEditing={Boolean(editingMessageId)}
        onCancelEdit={() => {
          setEditingMessageId(null);
          setDraftValue("");
        }}
        replyPreview={replyingTo ? {
          senderName: replyingTo.senderName,
          preview: replyingTo.preview,
          messageType: replyingTo.messageType,
        } : null}
        onCancelReply={() => setReplyingTo(null)}
        placeholder={editingMessageId ? "Edit your message..." : "Type a message..."}
      />

      <TreasureBoxRevealDialog
        open={Boolean(activeTreasureMessage)}
        onOpenChange={(open) => {
          if (!open) {
            setActiveTreasureMessageId(null);
          }
        }}
        message={activeTreasureMessage?.hidden_message || ""}
        opened={Boolean(activeTreasureMessage?.is_opened)}
        textStyle={activeTreasureMessage?.text_style}
        themeType={activeTreasureMessage?.theme_type}
      />

      <EncryptionDialog
        open={encryptionDialogOpen}
        onOpenChange={setEncryptionDialogOpen}
        defaultPassphrase={conversationPassphrase}
        encrypted={conversationEncrypted}
        onSave={(passphrase) => {
          if (!conversation?.id) return;
          setConversationPassphraseValue(passphrase);
          persistConversationPassphrase(conversation.id, passphrase);
          setConversationEncrypted(true);
          toast.success("End-to-end encryption enabled for this chat on this device.");
          void window.location.reload();
        }}
        onDisable={() => {
          if (!conversation?.id) return;
          clearConversationPassphrase(conversation.id);
          setConversationPassphraseValue("");
          setConversationEncrypted(false);
          toast.success("Encryption disabled for new messages in this chat.");
          void window.location.reload();
        }}
      />
      <UserProfilePanel
        open={profilePanelOpen}
        onOpenChange={setProfilePanelOpen}
        conversation={conversation}
        messages={messages}
      />

    </div>
  );
};

export default ChatView;
