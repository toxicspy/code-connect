import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type ChatRequestRow = Tables<"chat_requests">;
type Profile = Tables<"profiles">;

export type EnrichedChatRequest = ChatRequestRow & {
  senderProfile?: Profile | null;
  receiverProfile?: Profile | null;
};

export type BlockedUserEntry = {
  userId: string;
  profile: Profile | null;
  latestRequest: EnrichedChatRequest | null;
};

export type ChatRequestState = "none" | "pending_sent" | "pending_received" | "accepted" | "rejected" | "blocked";

const buildProfileMap = (profiles: Profile[] | null) =>
  new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));

export const useChatRequests = () => {
  const { user } = useAuth();
  const [incomingRequests, setIncomingRequests] = useState<EnrichedChatRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<EnrichedChatRequest[]>([]);
  const [blockedEntries, setBlockedEntries] = useState<BlockedUserEntry[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const [acceptedChatUserIds, setAcceptedChatUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!user) {
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setBlockedEntries([]);
      setBlockedUserIds(new Set());
      setAcceptedChatUserIds(new Set());
      setLoading(false);
      return;
    }

    setLoading(true);

    const [
      incomingResponse,
      outgoingResponse,
      blockedResponse,
      chatsResponse,
    ] = await Promise.all([
      supabase
        .from("chat_requests")
        .select("*")
        .eq("receiver_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("chat_requests")
        .select("*")
        .eq("sender_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("blocks")
        .select("blocked_user_id")
        .eq("blocker_id", user.id),
      supabase
        .from("chats")
        .select("user1_id, user2_id")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`),
    ]);

    const incoming = (incomingResponse.data ?? []) as ChatRequestRow[];
    const outgoing = (outgoingResponse.data ?? []) as ChatRequestRow[];
    const blockedRows = blockedResponse.data ?? [];
    const chatRows = chatsResponse.data ?? [];

    const profileIds = Array.from(
      new Set(
        [...incoming.map((request) => request.sender_id), ...outgoing.map((request) => request.receiver_id)],
      ),
    );

    const { data: profiles } = profileIds.length
      ? await supabase.from("profiles").select("*").in("user_id", profileIds)
      : { data: [] as Profile[] };

    const profileMap = buildProfileMap(profiles as Profile[] | null);

    setIncomingRequests(
      incoming.map((request) => ({
        ...request,
        senderProfile: profileMap.get(request.sender_id) ?? null,
      })),
    );

    setOutgoingRequests(
      outgoing.map((request) => ({
        ...request,
        receiverProfile: profileMap.get(request.receiver_id) ?? null,
      })),
    );

    const incomingBySender = new Map<string, EnrichedChatRequest>();
    incoming.forEach((request) => {
      const existing = incomingBySender.get(request.sender_id);
      if (!existing || new Date(request.created_at).getTime() > new Date(existing.created_at).getTime()) {
        incomingBySender.set(request.sender_id, {
          ...request,
          senderProfile: profileMap.get(request.sender_id) ?? null,
        });
      }
    });

    setBlockedEntries(
      blockedRows.map((row) => ({
        userId: row.blocked_user_id,
        profile: profileMap.get(row.blocked_user_id) ?? null,
        latestRequest: incomingBySender.get(row.blocked_user_id) ?? null,
      })),
    );

    setBlockedUserIds(new Set(blockedRows.map((row) => row.blocked_user_id)));
    setAcceptedChatUserIds(
      new Set(
        chatRows.map((row) => (row.user1_id === user.id ? row.user2_id : row.user1_id)),
      ),
    );

    setLoading(false);
  }, [user]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`chat-requests-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_requests" }, () => {
        void fetchRequests();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chats" }, () => {
        void fetchRequests();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "blocks" }, () => {
        void fetchRequests();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchRequests, user]);

  const getRequestStateForUser = useCallback((targetUserId: string): ChatRequestState => {
    if (blockedUserIds.has(targetUserId)) return "blocked";
    if (acceptedChatUserIds.has(targetUserId)) return "accepted";

    const incomingPending = incomingRequests.find(
      (request) => request.sender_id === targetUserId && request.status === "pending",
    );
    if (incomingPending) return "pending_received";

    const outgoingLatest = outgoingRequests.find((request) => request.receiver_id === targetUserId);
    if (!outgoingLatest) return "none";
    if (outgoingLatest.status === "pending") return "pending_sent";
    if (outgoingLatest.status === "accepted") return "accepted";
    if (outgoingLatest.status === "rejected") return "rejected";
    return "none";
  }, [acceptedChatUserIds, blockedUserIds, incomingRequests, outgoingRequests]);

  const sendRequest = async (receiverId: string) => {
    const { data, error } = await supabase.rpc("send_chat_request", { _receiver_id: receiverId });
    if (!error) {
      await fetchRequests();
    }
    return { data, error };
  };

  const acceptRequest = async (requestId: string) => {
    const { data, error } = await supabase.rpc("accept_chat_request", { _request_id: requestId });
    if (!error) {
      await fetchRequests();
    }
    return { data, error };
  };

  const rejectRequest = async (requestId: string, shouldBlock = false) => {
    const { data, error } = await supabase.rpc("reject_chat_request", {
      _request_id: requestId,
      _should_block: shouldBlock,
    });
    if (!error) {
      await fetchRequests();
    }
    return { data, error };
  };

  const blockUser = async (blockedUserId: string) => {
    const { data, error } = await supabase.rpc("block_chat_user", { _blocked_user_id: blockedUserId });
    if (!error) {
      await fetchRequests();
    }
    return { data, error };
  };

  const unblockUser = async (blockedUserId: string) => {
    const { error } = await supabase.rpc("unblock_chat_user", { _blocked_user_id: blockedUserId });
    if (!error) {
      await fetchRequests();
    }
    return { error };
  };

  const unblockAndAcceptRequest = async (requestId: string) => {
    const { data, error } = await supabase.rpc("unblock_and_accept_chat_request", { _request_id: requestId });
    if (!error) {
      await fetchRequests();
    }
    return { data, error };
  };

  const pendingIncomingCount = useMemo(
    () => incomingRequests.filter((request) => request.status === "pending").length,
    [incomingRequests],
  );

  return {
    incomingRequests,
    outgoingRequests,
    blockedEntries,
    pendingIncomingCount,
    loading,
    getRequestStateForUser,
    sendRequest,
    acceptRequest,
    rejectRequest,
    blockUser,
    unblockUser,
    unblockAndAcceptRequest,
    refreshRequests: fetchRequests,
  };
};
