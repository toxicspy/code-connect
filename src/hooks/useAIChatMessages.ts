import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import { generateUUID } from "@/lib/utils";

export interface AIChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export type AIChatReaction = Tables<"ai_message_reactions">;

export const useAIChatMessages = (aiProfileId: string | null) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [reactionsByMessage, setReactionsByMessage] = useState<Record<string, AIChatReaction[]>>({});
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!aiProfileId || !user) return;
    setLoading(true);
    const { data } = await supabase
      .from("ai_chat_messages")
      .select("*")
      .eq("ai_profile_id", aiProfileId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    const nextMessages = (data as AIChatMessage[]) || [];
    setMessages(nextMessages);

    const messageIds = nextMessages.map((message) => message.id);
    if (messageIds.length === 0) {
      setReactionsByMessage({});
      setLoading(false);
      return;
    }

    const { data: reactions } = await supabase
      .from("ai_message_reactions")
      .select("*")
      .in("ai_message_id", messageIds)
      .order("created_at", { ascending: true });

    const groupedReactions = ((reactions as AIChatReaction[]) || []).reduce<Record<string, AIChatReaction[]>>((accumulator, reaction) => {
      if (!accumulator[reaction.ai_message_id]) {
        accumulator[reaction.ai_message_id] = [];
      }
      accumulator[reaction.ai_message_id].push(reaction);
      return accumulator;
    }, {});

    setReactionsByMessage(groupedReactions);
    setLoading(false);
  }, [aiProfileId, user]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!aiProfileId || !user) return;

    const channel = supabase
      .channel(`ai-messages-${aiProfileId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_chat_messages", filter: `ai_profile_id=eq.${aiProfileId}` },
        (payload) => {
          const insertedMessage = payload.new as AIChatMessage;
          setMessages((prev) => {
            if (prev.some((message) => message.id === insertedMessage.id)) return prev;
            return [...prev, insertedMessage];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ai_chat_messages", filter: `ai_profile_id=eq.${aiProfileId}` },
        (payload) => {
          const updatedMessage = payload.new as AIChatMessage;
          setMessages((prev) => prev.map((message) => (
            message.id === updatedMessage.id ? updatedMessage : message
          )));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "ai_chat_messages", filter: `ai_profile_id=eq.${aiProfileId}` },
        (payload) => {
          setMessages((prev) => prev.filter((message) => message.id !== payload.old.id));
          setReactionsByMessage((prev) => {
            const next = { ...prev };
            delete next[payload.old.id as string];
            return next;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_message_reactions" },
        (payload) => {
          const reaction = payload.new as AIChatReaction;
          setReactionsByMessage((prev) => {
            const existing = prev[reaction.ai_message_id] ?? [];
            if (existing.some((item) => item.id === reaction.id)) return prev;
            return {
              ...prev,
              [reaction.ai_message_id]: [...existing, reaction],
            };
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ai_message_reactions" },
        (payload) => {
          const reaction = payload.new as AIChatReaction;
          setReactionsByMessage((prev) => ({
            ...prev,
            [reaction.ai_message_id]: (prev[reaction.ai_message_id] ?? []).map((item) => item.id === reaction.id ? reaction : item),
          }));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "ai_message_reactions" },
        (payload) => {
          const reaction = payload.old as AIChatReaction;
          setReactionsByMessage((prev) => ({
            ...prev,
            [reaction.ai_message_id]: (prev[reaction.ai_message_id] ?? []).filter((item) => item.id !== reaction.id),
          }));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [aiProfileId, user]);

  const sendMessage = async (content: string, systemPrompt: string) => {
    if (!user || !aiProfileId || !content.trim()) return;

    // Save user message
    const { data: userMsg } = await supabase
      .from("ai_chat_messages")
      .insert({ ai_profile_id: aiProfileId, user_id: user.id, role: "user", content: content.trim() })
      .select()
      .single();

    if (userMsg) {
      setMessages((prev) => [...prev, userMsg as AIChatMessage]);
    }

    // Build conversation history for context
    const history = [...messages, { role: "user" as const, content: content.trim() }].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Stream AI response
    setStreaming(true);
    let assistantContent = "";

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: history, systemPrompt }),
        }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;
      const tempId = generateUUID();

      // Add placeholder assistant message
      setMessages((prev) => [...prev, { id: tempId, role: "assistant", content: "", created_at: new Date().toISOString() }]);

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) {
              assistantContent += delta;
              setMessages((prev) =>
                prev.map((m) => (m.id === tempId ? { ...m, content: assistantContent } : m))
              );
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Save assistant message to DB
      const { data: savedMsg } = await supabase
        .from("ai_chat_messages")
        .insert({ ai_profile_id: aiProfileId, user_id: user.id, role: "assistant", content: assistantContent })
        .select()
        .single();

      if (savedMsg) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? (savedMsg as AIChatMessage) : m))
        );
      }
    } catch (err: any) {
      console.error("AI chat error:", err);
      // Remove placeholder on error
      setMessages((prev) => prev.filter((m) => m.content !== "" || m.role !== "assistant"));
      throw err;
    } finally {
      setStreaming(false);
    }
  };

  const deleteMessages = async (messageIds: string[]) => {
    if (messageIds.length === 0) return { error: null };

    const previousMessages = messages;
    setMessages((prev) => prev.filter((message) => !messageIds.includes(message.id)));

    const { error } = await supabase.from("ai_chat_messages").delete().in("id", messageIds);

    if (error) {
      setMessages(previousMessages);
    }

    return { error };
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return { error: new Error("You must be signed in") };

    const existingReaction = (reactionsByMessage[messageId] ?? []).find((reaction) => reaction.user_id === user.id);

    if (!existingReaction) {
      const optimisticReaction: AIChatReaction = {
        id: `temp-ai-reaction-${generateUUID()}`,
        ai_message_id: messageId,
        user_id: user.id,
        emoji,
        created_at: new Date().toISOString(),
      };

      setReactionsByMessage((prev) => ({
        ...prev,
        [messageId]: [...(prev[messageId] ?? []), optimisticReaction],
      }));

      const { data, error } = await supabase
        .from("ai_message_reactions")
        .insert({
          ai_message_id: messageId,
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
        [messageId]: (prev[messageId] ?? []).map((reaction) => reaction.id === optimisticReaction.id ? (data as AIChatReaction) : reaction),
      }));

      return { error: null };
    }

    if (existingReaction.emoji === emoji) {
      const previousReactions = reactionsByMessage[messageId] ?? [];
      setReactionsByMessage((prev) => ({
        ...prev,
        [messageId]: (prev[messageId] ?? []).filter((reaction) => reaction.id !== existingReaction.id),
      }));

      const { error } = await supabase
        .from("ai_message_reactions")
        .delete()
        .eq("id", existingReaction.id)
        .eq("user_id", user.id);

      if (error) {
        setReactionsByMessage((prev) => ({
          ...prev,
          [messageId]: previousReactions,
        }));
      }

      return { error };
    }

    const previousReactions = reactionsByMessage[messageId] ?? [];
    setReactionsByMessage((prev) => ({
      ...prev,
      [messageId]: (prev[messageId] ?? []).map((reaction) => reaction.id === existingReaction.id ? { ...reaction, emoji } : reaction),
    }));

    const { data, error } = await supabase
      .from("ai_message_reactions")
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
      [messageId]: (prev[messageId] ?? []).map((reaction) => reaction.id === existingReaction.id ? (data as AIChatReaction) : reaction),
    }));

    return { error: null };
  };

  return { messages, reactionsByMessage, loading, streaming, sendMessage, deleteMessages, toggleReaction };
};
