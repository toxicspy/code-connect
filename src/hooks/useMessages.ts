import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

type Message = Tables<"messages">;
export type ChatMessage = Message & { clientStatus?: "sending" };

export const useMessages = (conversationId: string | null) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages(data || []);
    setLoading(false);
  }, [conversationId]);

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
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    markConversationAsRead();
  }, [markConversationAsRead]);

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const insertedMessage = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((message) => message.id === insertedMessage.id)) return prev;
            return [...prev, insertedMessage];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const updatedMessage = payload.new as ChatMessage;
          setMessages((prev) => prev.map((message) => (
            message.id === updatedMessage.id ? updatedMessage : message
          )));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => prev.filter((message) => message.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  const sendMessage = async (content: string) => {
    if (!user || !conversationId || !content.trim()) return;

    const trimmedContent = content.trim();
    const tempId = `temp-${crypto.randomUUID()}`;
    const tempMessage: ChatMessage = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user.id,
      content: trimmedContent,
      created_at: new Date().toISOString(),
      read_at: null,
      clientStatus: "sending",
    };

    setMessages((prev) => [...prev, tempMessage]);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: trimmedContent,
      })
      .select()
      .single();

    if (error) {
      setMessages((prev) => prev.filter((message) => message.id !== tempId));
      return;
    }

    if (data) {
      setMessages((prev) => prev.map((message) => (
        message.id === tempId ? (data as ChatMessage) : message
      )));
    }
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
      prev.map((message) => (
        message.id === messageId ? { ...message, content: trimmedContent } : message
      ))
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

  return { messages, loading, sendMessage, editMessage, deleteMessages };
};
