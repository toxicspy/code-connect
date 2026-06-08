import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type Message = Tables<"messages">;

export interface ConversationWithDetails {
  id: string;
  otherUser: Profile;
  lastMessage?: Pick<Message, "content" | "created_at" | "sender_id" | "message_type" | "is_opened" | "media_type" | "media_url" | "file_name" | "is_encrypted">;
  updated_at: string;
  is_pinned: boolean;
  is_archived: boolean;
  unreadCount: number;
}

export const useConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    if (!user) return;

    const { data: participations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (!participations?.length) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const convIds = participations.map((p) => p.conversation_id);

    const { data: allParticipants } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id, is_pinned, is_archived")
      .in("conversation_id", convIds)
      .neq("user_id", user.id);

    // Also fetch current user's participation for pin/archive status
    const { data: myParticipantDetails } = await supabase
      .from("conversation_participants")
      .select("conversation_id, is_pinned, is_archived")
      .in("conversation_id", convIds)
      .eq("user_id", user.id);

    const myStatusMap = new Map(myParticipantDetails?.map((p) => [p.conversation_id, { is_pinned: p.is_pinned, is_archived: p.is_archived }]));

    if (!allParticipants?.length) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const otherUserIds = [...new Set(allParticipants.map((p) => p.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("user_id", otherUserIds);

    const { data: unreadMessages } = await supabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", convIds)
      .neq("sender_id", user.id)
      .is("read_at", null);

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));
    const unreadCountMap = new Map<string, number>();

    unreadMessages?.forEach((message) => {
      unreadCountMap.set(message.conversation_id, (unreadCountMap.get(message.conversation_id) ?? 0) + 1);
    });

    const results: ConversationWithDetails[] = [];
    const seenConvIds = new Set<string>();

    for (const part of allParticipants) {
      if (seenConvIds.has(part.conversation_id)) continue;
      seenConvIds.add(part.conversation_id);

      const profile = profileMap.get(part.user_id);
      if (!profile) continue;

      const { data: msgs } = await supabase
        .from("messages")
        .select("content, created_at, sender_id, message_type, is_opened, media_type, media_url, file_name, is_encrypted")
        .eq("conversation_id", part.conversation_id)
        .order("created_at", { ascending: false })
        .limit(1);

      const myStatus = myStatusMap.get(part.conversation_id);
      results.push({
        id: part.conversation_id,
        otherUser: profile,
        lastMessage: msgs?.[0] || undefined,
        updated_at: msgs?.[0]?.created_at || new Date().toISOString(),
        is_pinned: myStatus?.is_pinned ?? false,
        is_archived: myStatus?.is_archived ?? false,
        unreadCount: unreadCountMap.get(part.conversation_id) ?? 0,
      });
    }

    results.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    setConversations(results);
    setLoading(false);
  };

  useEffect(() => {
    fetchConversations();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("conversations-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return { conversations, loading, refetch: fetchConversations };
};
