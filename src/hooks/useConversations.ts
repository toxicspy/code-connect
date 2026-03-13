import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

export interface ConversationWithDetails {
  id: string;
  otherUser: Profile;
  lastMessage?: { content: string; created_at: string; sender_id: string };
  updated_at: string;
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
      .select("conversation_id, user_id")
      .in("conversation_id", convIds)
      .neq("user_id", user.id);

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

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));

    const results: ConversationWithDetails[] = [];

    for (const part of allParticipants) {
      const profile = profileMap.get(part.user_id);
      if (!profile) continue;

      const { data: msgs } = await supabase
        .from("messages")
        .select("content, created_at, sender_id")
        .eq("conversation_id", part.conversation_id)
        .order("created_at", { ascending: false })
        .limit(1);

      results.push({
        id: part.conversation_id,
        otherUser: profile,
        lastMessage: msgs?.[0] || undefined,
        updated_at: msgs?.[0]?.created_at || new Date().toISOString(),
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return { conversations, loading, refetch: fetchConversations };
};
