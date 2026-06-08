import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import { generateUUID } from "@/lib/utils";
import {
  DEFAULT_TREASURE_STYLE,
  TEXT_MESSAGE_TYPE,
  TREASURE_BOX_PREVIEW,
  TREASURE_MESSAGE_TYPE,
  getTreasureStyleDefinition,
  type SupportedMessageType,
  type TreasureTextStyle,
} from "@/lib/message-utils";
import {
  ENCRYPTED_MESSAGE_FAILED,
  ENCRYPTED_MESSAGE_LOCKED,
  encryptConversationText,
  decryptConversationText,
} from "@/lib/chat-encryption";
import { getOrCreateDeviceId } from "@/lib/device-fingerprint";

type Message = Tables<"messages">;
type MessageReaction = Tables<"message_reactions">;

export type ChatMessage = Message & { clientStatus?: "sending" };
export type ChatMessageReaction = MessageReaction;

interface SendMessageOptions {
  messageType?: SupportedMessageType;
  hiddenMessage?: string | null;
  textStyle?: TreasureTextStyle;
  themeType?: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  fileName?: string | null;
  isEncrypted?: boolean;
  encryptionNonce?: string | null;
  encryptionVersion?: number | null;
  repliedMessageId?: string | null;
  repliedMessageContent?: string | null;
  repliedUserId?: string | null;
  repliedMessageType?: string | null;
}

const buildOptimisticMessage = (
  tempId: string,
  conversationId: string,
  senderId: string,
  content: string,
  options: Required<Omit<SendMessageOptions, "textStyle">> & { textStyle: string },
): ChatMessage => ({
  id: tempId,
  conversation_id: conversationId,
  sender_id: senderId,
  content,
  created_at: new Date().toISOString(),
  read_at: null,
  file_name: options.fileName,
  hidden_message: options.hiddenMessage,
  is_opened: false,
  media_type: options.mediaType,
  media_url: options.mediaUrl,
  is_encrypted: options.isEncrypted,
  encryption_nonce: options.encryptionNonce,
  encryption_version: options.encryptionVersion,
  replied_message_id: options.repliedMessageId,
  replied_message_content: options.repliedMessageContent,
  replied_user_id: options.repliedUserId,
  replied_message_type: options.repliedMessageType,
  message_type: options.messageType,
  opened_at: null,
  text_style: options.textStyle,
  theme_type: options.themeType,
  clientStatus: "sending",
});

export const useMessages = (conversationId: string | null, otherUserId?: string | null) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactionsByMessage, setReactionsByMessage] = useState<Record<string, ChatMessageReaction[]>>({});
  const [loading, setLoading] = useState(false);

  const syncReactionsForMessageIds = useCallback(async (messageIds: string[], replaceAll = false) => {
    if (messageIds.length === 0) {
      setReactionsByMessage({});
      return;
    }

    const { data: reactions, error } = await supabase
      .from("message_reactions")
      .select("*")
      .in("message_id", messageIds)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to sync message reactions:", error);
      return;
    }

    const groupedReactions = ((reactions as ChatMessageReaction[]) || []).reduce<Record<string, ChatMessageReaction[]>>((accumulator, reaction) => {
      if (!accumulator[reaction.message_id]) {
        accumulator[reaction.message_id] = [];
      }
      accumulator[reaction.message_id].push(reaction);
      return accumulator;
    }, {});

    setReactionsByMessage((prev) => {
      if (replaceAll) {
        return groupedReactions;
      }

      const next = { ...prev };
      for (const messageId of messageIds) {
        if (groupedReactions[messageId]?.length) {
          next[messageId] = groupedReactions[messageId];
        } else {
          delete next[messageId];
        }
      }
      return next;
    });
  }, []);

  const resolveMessageForDisplay = useCallback(async (message: ChatMessage) => {
    if (!conversationId || !message.is_encrypted) {
      return message;
    }

    try {
      const decryptedContent = await decryptConversationText(conversationId, message.content, message.encryption_nonce);
      return {
        ...message,
        content: decryptedContent ?? ENCRYPTED_MESSAGE_LOCKED,
      };
    } catch {
      return {
        ...message,
        content: ENCRYPTED_MESSAGE_FAILED,
      };
    }
  }, [conversationId]);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;

    setLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    const resolvedMessages = await Promise.all(((data as ChatMessage[]) || []).map(resolveMessageForDisplay));
    setMessages(resolvedMessages);

    const messageIds = resolvedMessages.map((message) => message.id);
    if (messageIds.length === 0) {
      setReactionsByMessage({});
      setLoading(false);
      return;
    }

    await syncReactionsForMessageIds(messageIds, true);
    setLoading(false);
  }, [conversationId, resolveMessageForDisplay, syncReactionsForMessageIds]);

  const markConversationAsRead = useCallback(async () => {
    if (!conversationId || !user) return;

    const unreadIncomingIds = messages
      .filter((message) => message.sender_id !== user.id && !message.read_at)
      .map((message) => message.id);

    if (unreadIncomingIds.length === 0) return;

    const { error } = await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIncomingIds);

    if (error) {
      console.error("Failed to mark messages as read:", error);
    }
  }, [conversationId, messages, user]);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    void markConversationAsRead();
  }, [markConversationAsRead]);

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const insertedMessage = await resolveMessageForDisplay(payload.new as ChatMessage);
          setMessages((prev) => {
            const optimisticMatchIndex = prev.findIndex(
              (message) =>
                message.clientStatus === "sending" &&
                message.sender_id === insertedMessage.sender_id &&
                message.content === insertedMessage.content &&
                message.created_at <= insertedMessage.created_at,
            );

            if (optimisticMatchIndex >= 0) {
              const next = [...prev];
              next[optimisticMatchIndex] = insertedMessage;
              return next;
            }

            if (prev.some((message) => message.id === insertedMessage.id)) {
              return prev;
            }

            return [...prev, insertedMessage];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const updatedMessage = await resolveMessageForDisplay(payload.new as ChatMessage);
          setMessages((prev) =>
            prev.map((message) => (message.id === updatedMessage.id ? updatedMessage : message)),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => prev.filter((message) => message.id !== payload.old.id));
          setReactionsByMessage((prev) => {
            const next = { ...prev };
            delete next[payload.old.id as string];
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_reactions" },
        (payload) => {
          const reaction = payload.new as ChatMessageReaction;
          setReactionsByMessage((prev) => {
            if (!messages.some((message) => message.id === reaction.message_id)) {
              return prev;
            }
            const existing = prev[reaction.message_id] ?? [];
            if (existing.some((item) => item.id === reaction.id)) {
              return prev;
            }
            return {
              ...prev,
              [reaction.message_id]: [...existing, reaction],
            };
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "message_reactions" },
        (payload) => {
          const reaction = payload.new as ChatMessageReaction;
          setReactionsByMessage((prev) => {
            if (!messages.some((message) => message.id === reaction.message_id)) {
              return prev;
            }

            return {
              ...prev,
              [reaction.message_id]: (prev[reaction.message_id] ?? []).map((item) => (item.id === reaction.id ? reaction : item)),
            };
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "message_reactions" },
        (payload) => {
          const deletedReaction = payload.old as ChatMessageReaction;
          setReactionsByMessage((prev) => ({
            ...prev,
            [deletedReaction.message_id]: (prev[deletedReaction.message_id] ?? []).filter((item) => item.id !== deletedReaction.id),
          }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, messages, resolveMessageForDisplay]);

  const sendMessage = async (content: string, options: SendMessageOptions = {}) => {
    if (!user || !conversationId) return { error: new Error("Missing conversation context") };

    if (otherUserId) {
      const { data: blockRecord, error: blockLookupError } = await supabase
        .from("blocked_users")
        .select("id")
        .eq("blocker_user_id", otherUserId)
        .eq("blocked_user_id", user.id)
        .maybeSingle();

      if (blockLookupError) {
        return { error: blockLookupError };
      }

      if (blockRecord) {
        return { error: new Error("This user has blocked you. Your message was not sent.") };
      }
    }

    const resolvedContent = content.trim() || options.fileName || "";
    if (!resolvedContent) return { error: new Error("Message content is required") };

    const treasureStyle = options.textStyle ?? DEFAULT_TREASURE_STYLE;
    const treasureTheme = options.themeType ?? getTreasureStyleDefinition(treasureStyle).theme;
    const messageType = options.messageType ?? TEXT_MESSAGE_TYPE;
    const tempId = `temp-${generateUUID()}`;
    const deviceId = await getOrCreateDeviceId();
    const shouldEncrypt = Boolean(conversationId && !options.mediaUrl);
    const encryptedPayload = shouldEncrypt ? await encryptConversationText(conversationId, resolvedContent) : null;
    const tempMessage = buildOptimisticMessage(tempId, conversationId, user.id, resolvedContent, {
      messageType,
      hiddenMessage: options.hiddenMessage ?? null,
      textStyle: treasureStyle,
      themeType: treasureTheme,
      mediaUrl: options.mediaUrl ?? null,
      mediaType: options.mediaType ?? null,
      fileName: options.fileName ?? null,
      isEncrypted: Boolean(encryptedPayload),
      encryptionNonce: encryptedPayload?.nonce ?? null,
      encryptionVersion: encryptedPayload?.version ?? null,
    });

    setMessages((prev) => [...prev, tempMessage]);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: encryptedPayload?.content ?? resolvedContent,
        message_type: messageType,
        hidden_message: options.hiddenMessage ?? null,
        text_style: treasureStyle,
        theme_type: treasureTheme,
        media_url: options.mediaUrl ?? null,
        media_type: options.mediaType ?? null,
        file_name: options.fileName ?? null,
        device_id: deviceId,
        is_encrypted: Boolean(encryptedPayload),
        encryption_nonce: encryptedPayload?.nonce ?? null,
        encryption_version: encryptedPayload?.version ?? null,
        replied_message_id: options.repliedMessageId ?? null,
        replied_message_content: options.repliedMessageContent ?? null,
        replied_user_id: options.repliedUserId ?? null,
        replied_message_type: options.repliedMessageType ?? null,
      })
      .select()
      .single();

    if (error) {
      setMessages((prev) => prev.filter((message) => message.id !== tempId));
      return { error };
    }

    if (data) {
      setMessages((prev) =>
        prev.map((message) => (message.id === tempId ? (data as ChatMessage) : message)),
      );
    }

    return { error: null, data };
  };

  const sendTreasureMessage = async (hiddenMessage: string, textStyle: TreasureTextStyle) => {
    const trimmedHiddenMessage = hiddenMessage.trim();
    if (!trimmedHiddenMessage) {
      return { error: new Error("Treasure message cannot be empty") };
    }

    const styleDefinition = getTreasureStyleDefinition(textStyle);
    return sendMessage(TREASURE_BOX_PREVIEW, {
      messageType: TREASURE_MESSAGE_TYPE,
      hiddenMessage: trimmedHiddenMessage,
      textStyle,
      themeType: styleDefinition.theme,
    });
  };

  const openTreasureMessage = async (messageId: string) => {
    const openedAt = new Date().toISOString();
    const previousMessages = messages;

    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId
          ? { ...message, is_opened: true, opened_at: openedAt }
          : message,
      ),
    );

    const { error } = await supabase
      .from("messages")
      .update({ is_opened: true, opened_at: openedAt })
      .eq("id", messageId)
      .eq("conversation_id", conversationId ?? "");

    if (error) {
      setMessages(previousMessages);
    }

    return { error };
  };

  const deleteMessages = async (messageIds: string[]) => {
    if (messageIds.length === 0) return { error: null };

    const previousMessages = messages;
    setMessages((prev) => prev.filter((message) => !messageIds.includes(message.id)));

    const { error } = await supabase.from("messages").delete().in("id", messageIds);

    if (error) {
      setMessages(previousMessages);
    }

    return { error };
  };

  const editMessage = async (messageId: string, content: string) => {
    if (!user || !conversationId || !content.trim()) return { error: null };

    const trimmedContent = content.trim();
    const previousMessages = messages;
    setMessages((prev) =>
      prev.map((message) => (message.id === messageId ? { ...message, content: trimmedContent } : message)),
    );

    const { error } = await supabase
      .from("messages")
      .update({ content: trimmedContent })
      .eq("id", messageId)
      .eq("sender_id", user.id)
      .eq("conversation_id", conversationId);

    if (error) {
      setMessages(previousMessages);
    }

    return { error };
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return { error: new Error("You must be signed in") };

    const existingReaction = (reactionsByMessage[messageId] ?? []).find((reaction) => reaction.user_id === user.id);

    if (!existingReaction) {
      const optimisticReaction: ChatMessageReaction = {
        id: `temp-reaction-${generateUUID()}`,
        message_id: messageId,
        user_id: user.id,
        emoji,
        created_at: new Date().toISOString(),
      };

      setReactionsByMessage((prev) => ({
        ...prev,
        [messageId]: [...(prev[messageId] ?? []), optimisticReaction],
      }));

      const { data, error } = await supabase
        .from("message_reactions")
        .insert({
          message_id: messageId,
          user_id: user.id,
          emoji,
        })
        .select()
        .single();

      if (error) {
        setReactionsByMessage((prev) => ({
          ...prev,
          [messageId]: (prev[messageId] ?? []).filter((reaction) => reaction.id !== optimisticReaction.id),
        }));
        return { error };
      }

      setReactionsByMessage((prev) => ({
        ...prev,
        [messageId]: (prev[messageId] ?? []).map((reaction) => (reaction.id === optimisticReaction.id ? (data as ChatMessageReaction) : reaction)),
      }));

      await syncReactionsForMessageIds([messageId]);

      return { error: null };
    }

    if (existingReaction.emoji === emoji) {
      const previousReactions = reactionsByMessage[messageId] ?? [];
      setReactionsByMessage((prev) => ({
        ...prev,
        [messageId]: (prev[messageId] ?? []).filter((reaction) => reaction.id !== existingReaction.id),
      }));

      const { error } = await supabase
        .from("message_reactions")
        .delete()
        .eq("id", existingReaction.id)
        .eq("user_id", user.id);

      if (error) {
        setReactionsByMessage((prev) => ({
          ...prev,
          [messageId]: previousReactions,
        }));
        return { error };
      }

      await syncReactionsForMessageIds([messageId]);

      return { error: null };
    }

    const previousReactions = reactionsByMessage[messageId] ?? [];
    setReactionsByMessage((prev) => ({
      ...prev,
      [messageId]: (prev[messageId] ?? []).map((reaction) =>
        reaction.id === existingReaction.id ? { ...reaction, emoji } : reaction,
      ),
    }));

    const { data, error } = await supabase
      .from("message_reactions")
      .update({ emoji })
      .eq("id", existingReaction.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      setReactionsByMessage((prev) => ({
        ...prev,
        [messageId]: previousReactions,
      }));
      return { error };
    }

    setReactionsByMessage((prev) => ({
      ...prev,
      [messageId]: (prev[messageId] ?? []).map((reaction) => (reaction.id === existingReaction.id ? (data as ChatMessageReaction) : reaction)),
    }));

    await syncReactionsForMessageIds([messageId]);

    return { error: null };
  };

  return {
    messages,
    reactionsByMessage,
    loading,
    sendMessage,
    sendTreasureMessage,
    openTreasureMessage,
    editMessage,
    deleteMessages,
    toggleReaction,
  };
};
