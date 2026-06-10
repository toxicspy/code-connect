import { lazy, useState, useEffect, useCallback, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations, ConversationWithDetails } from "@/hooks/useConversations";
import { useChatRequests } from "@/hooks/useChatRequests";
import { supabase } from "@/integrations/supabase/client";
import { Search, UserPlus, LogOut, Copy, MessageCircle, Loader2, MoreVertical, Archive, Pin, Bot, Plus, Inbox, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
const AddContactDialog = lazy(() => import("./AddContactDialog"));
const ProfileEditDialog = lazy(() => import("./ProfileEditDialog"));
import ConversationContextMenu from "./ConversationContextMenu";
const CreateAIChatDialog = lazy(() => import("./CreateAIChatDialog"));
import AIChatContextMenu from "./AIChatContextMenu";
const RequestsDialog = lazy(() => import("./RequestsDialog"));
import type { Tables } from "@/integrations/supabase/types";
import type { AIProfile } from "./AIChatView";
import { getMessagePreview } from "@/lib/message-utils";
import { sanitizeDisplayName } from "@/lib/profile-utils";
import RequestButton from "./RequestButton";

type Profile = Tables<"profiles">;

interface ChatSidebarProps {
  selectedConversation: string | null;
  selectedAIProfileId?: string | null;
  aiProfilesVersion?: number;
  onSelectConversation: (conv: ConversationWithDetails) => void;
  onSelectAIChat?: (profile: AIProfile) => void;
  showAddContact?: boolean;
  onShowAddContactChange?: (show: boolean) => void;
  showRequests?: boolean;
  onShowRequestsChange?: (show: boolean) => void;
  searchInputFocused?: boolean;
  onSearchInputFocusedChange?: (focused: boolean) => void;
}

const ChatSidebar = ({
  selectedConversation,
  selectedAIProfileId,
  aiProfilesVersion = 0,
  onSelectConversation,
  onSelectAIChat,
  showAddContact: externalShowAddContact,
  onShowAddContactChange,
  showRequests: externalShowRequests,
  onShowRequestsChange,
  searchInputFocused: externalSearchInputFocused,
  onSearchInputFocusedChange,
}: ChatSidebarProps) => {
  const { user, profile, signOut } = useAuth();
  const { conversations, loading, refetch } = useConversations();
  const { pendingIncomingCount, getRequestStateForUser, sendRequest, refreshRequests } = useChatRequests();
  const [search, setSearch] = useState("");
  const [internalShowAddContact, setInternalShowAddContact] = useState(false);
  const [internalShowRequests, setInternalShowRequests] = useState(false);
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [requestingUserId, setRequestingUserId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [viewingArchivedChats, setViewingArchivedChats] = useState(false);
  const [showCreateAI, setShowCreateAI] = useState(false);
  const [aiProfiles, setAiProfiles] = useState<AIProfile[]>([]);
  const [tab, setTab] = useState<"chats" | "ai">("chats");

  // Use external state if provided, otherwise use internal state
  const showAddContact = externalShowAddContact !== undefined ? externalShowAddContact : internalShowAddContact;
  const setShowAddContact = (value: boolean) => {
    if (onShowAddContactChange) {
      onShowAddContactChange(value);
    } else {
      setInternalShowAddContact(value);
    }
  };

  const showRequests = externalShowRequests !== undefined ? externalShowRequests : internalShowRequests;
  const setShowRequests = (value: boolean) => {
    if (onShowRequestsChange) {
      onShowRequestsChange(value);
    } else {
      setInternalShowRequests(value);
    }
  };

  // Fetch AI profiles
  useEffect(() => {
    if (!user) return;
    const fetchAI = async () => {
      const { data } = await supabase
        .from("ai_chat_profiles")
        .select("id, name, avatar_url, system_prompt")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setAiProfiles((data as AIProfile[]) || []);
    };
    fetchAI();
  }, [user, aiProfilesVersion]);

  const normalizeSearchTerm = (term: string) => term.trim().replace(/^#/, "");

  // Debounced global user search
  useEffect(() => {
    if (!search.trim() || !user) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);

      const normalizedTerm = normalizeSearchTerm(search);
      const lowercaseTerm = normalizedTerm.toLowerCase();
      const upperTerm = normalizedTerm.toUpperCase();
      const collapsedTerm = lowercaseTerm.replace(/\s+/g, "");
      const isLikelyCode = /^[A-Z0-9]{4,}$/.test(upperTerm);

      try {
        const { data: exactCodeMatches, error: exactCodeError } = isLikelyCode
          ? await supabase
              .from("profiles")
              .select("*")
              .neq("user_id", user.id)
              .eq("user_code", upperTerm)
              .limit(8)
          : { data: [], error: null };

        if (exactCodeError) throw exactCodeError;

        const { data: candidateProfiles, error: candidateError } = await supabase
          .from("profiles")
          .select("*")
          .neq("user_id", user.id)
          .order("display_name", { ascending: true })
          .limit(500);

        if (candidateError) throw candidateError;
        if (isCancelled) return;

        const locallyMatchedProfiles = (candidateProfiles || []).filter((candidate) => {
          const candidateName = candidate.display_name.toLowerCase();
          const collapsedCandidateName = candidateName.replace(/\s+/g, "");
          const candidateCode = candidate.user_code.toUpperCase();

          return (
            candidateName.includes(lowercaseTerm) ||
            collapsedCandidateName.includes(collapsedTerm) ||
            candidateCode === upperTerm ||
            candidateCode.includes(upperTerm)
          );
        });

        const merged = [...(exactCodeMatches || []), ...locallyMatchedProfiles]
          .filter((candidate, index, list) => list.findIndex((entry) => entry.user_id === candidate.user_id) === index)
          .sort((left, right) => {
            const leftName = left.display_name.toLowerCase();
            const rightName = right.display_name.toLowerCase();
            const collapsedLeftName = leftName.replace(/\s+/g, "");
            const collapsedRightName = rightName.replace(/\s+/g, "");
            const leftCode = left.user_code.toUpperCase();
            const rightCode = right.user_code.toUpperCase();

            const leftCodeExact = leftCode === upperTerm ? 1 : 0;
            const rightCodeExact = rightCode === upperTerm ? 1 : 0;
            if (leftCodeExact !== rightCodeExact) return rightCodeExact - leftCodeExact;

            const leftExact = leftName === lowercaseTerm ? 1 : 0;
            const rightExact = rightName === lowercaseTerm ? 1 : 0;
            if (leftExact !== rightExact) return rightExact - leftExact;

            const leftCollapsedExact = collapsedLeftName === collapsedTerm ? 1 : 0;
            const rightCollapsedExact = collapsedRightName === collapsedTerm ? 1 : 0;
            if (leftCollapsedExact !== rightCollapsedExact) return rightCollapsedExact - leftCollapsedExact;

            const leftPrefix = leftName.startsWith(lowercaseTerm) ? 1 : 0;
            const rightPrefix = rightName.startsWith(lowercaseTerm) ? 1 : 0;
            if (leftPrefix !== rightPrefix) return rightPrefix - leftPrefix;

            const leftCollapsedPrefix = collapsedLeftName.startsWith(collapsedTerm) ? 1 : 0;
            const rightCollapsedPrefix = collapsedRightName.startsWith(collapsedTerm) ? 1 : 0;
            if (leftCollapsedPrefix !== rightCollapsedPrefix) return rightCollapsedPrefix - leftCollapsedPrefix;

            return leftName.localeCompare(rightName);
          });

        setSearchResults(merged.slice(0, 20));
      } catch (error) {
        if (!isCancelled) {
          console.error("Failed to search profiles", error);
          setSearchResults([]);
        }
      } finally {
        if (!isCancelled) {
          setSearching(false);
        }
      }
    }, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [search, user]);

  const openConversationWithUser = useCallback((targetUserId: string) => {
    const existingConversation = conversations.find((conversation) => conversation.otherUser.user_id === targetUserId);
    if (existingConversation) {
      onSelectConversation(existingConversation);
      return true;
    }
    return false;
  }, [conversations, onSelectConversation]);

  const handleSendRequest = useCallback(async (targetProfile: Profile) => {
    setRequestingUserId(targetProfile.user_id);
    const { error } = await sendRequest(targetProfile.user_id);
    setRequestingUserId(null);

    if (error) {
      toast.error(error.message || "Failed to send request");
      return;
    }

    toast.success(`Chat request sent to ${sanitizeDisplayName(targetProfile.display_name)}.`);
    await refreshRequests();
  }, [refreshRequests, sendRequest]);

  const removeAIProfile = (id: string) => {
    setAiProfiles((prev) => prev.filter((p) => p.id !== id));
    if (selectedAIProfileId === id) onSelectAIChat?.({} as any);
  };

  // Separate archived and active chats
  const archivedChats = conversations.filter((c) => c.is_archived);
  const activeChats = conversations.filter((c) => !c.is_archived);

  // Apply search filter and sorting to the appropriate list
  const chatListToShow = viewingArchivedChats ? archivedChats : activeChats;
  const filtered = chatListToShow
    .filter((c) => c.otherUser.display_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return 0;
    });

  const copyCode = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (profile?.user_code) {
      navigator.clipboard.writeText(profile.user_code);
      toast.success("Code copied!");
    }
  };

  const showGlobalResults = search.trim().length > 0 && tab === "chats";
  const conversationMap = new Map(conversations.map((conversation) => [conversation.otherUser.user_id, conversation]));

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-transparent">
      {/* Header */}
      <div className="border-b border-border/70 px-4 py-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowProfile(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-primary text-primary-foreground shadow-[0_16px_36px_-24px_hsl(var(--primary)/0.95)] transition-opacity hover:opacity-90 dark:border-white/10"
              title="Edit profile"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <MessageCircle className="h-4 w-4 text-primary-foreground" />
              )}
            </button>
            <div className="text-left">
              <h2 className="font-display text-sm font-semibold">{sanitizeDisplayName(profile?.display_name, "User")}</h2>
              <button onClick={copyCode} className="mt-1 flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-mono user-code-badge transition-colors hover:opacity-80">
                #{profile?.user_code}
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="flex gap-1">
            {tab === "chats" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowRequests(true)}
                className={`relative h-9 w-9 rounded-xl ${pendingIncomingCount > 0 ? "request-highlight-active" : ""}`}
                title="Chat requests"
              >
                <Inbox className="h-4 w-4" />
                {pendingIncomingCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
                    {pendingIncomingCount}
                  </span>
                )}
              </Button>
            )}
            {tab === "ai" && (
              <Button variant="ghost" size="icon" onClick={() => setShowCreateAI(true)} className="h-9 w-9 rounded-xl" title="New AI Chat">
                <Plus className="h-4 w-4" />
              </Button>
            )}
            {tab === "chats" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewingArchivedChats(true)}
                className={`relative h-9 w-9 rounded-xl ${viewingArchivedChats ? "bg-white/10" : ""}`}
                title="Archived chats"
              >
                <Archive className="h-4 w-4" />
                {archivedChats.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
                    {archivedChats.length}
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3 rounded-[1.35rem] border border-white/70 bg-white/65 p-1 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => setTab("chats")}
              className={`rounded-xl px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.24em] transition-all ${tab === "chats" ? "bg-white text-foreground shadow-sm dark:bg-white/10" : "text-muted-foreground hover:text-foreground"}`}
            >
              <MessageCircle className="mr-1 inline-block h-3.5 w-3.5" />
              Chats
            </button>
            <button
              onClick={() => setTab("ai")}
              className={`rounded-xl px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.24em] transition-all ${tab === "ai" ? "bg-white text-foreground shadow-sm dark:bg-white/10" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Bot className="mr-1 inline-block h-3.5 w-3.5" />
              AI Chats
            </button>
          </div>
        </div>
      </div>

      {/* Search (chats tab only) */}
      {tab === "chats" && (
        <div className="border-b border-border/60 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users by name or code..." className="h-11 rounded-2xl border-white/70 bg-white/80 pl-9 dark:border-white/10 dark:bg-white/5" />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="app-scroll-area flex-1 min-h-0 overflow-y-auto">
        {tab === "ai" ? (
          /* AI Chats list */
          aiProfiles.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Bot className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No AI chats yet</p>
              <p className="mt-1 text-xs text-muted-foreground/70">Tap + to create a custom AI assistant</p>
            </div>
          ) : (
            aiProfiles.map((ai) => (
              <div key={ai.id} className={`group relative mx-2 mt-2 flex w-auto items-center gap-3 rounded-[1.35rem] border px-3 py-3 text-left transition-all ${selectedAIProfileId === ai.id ? "border-primary/20 bg-accent/70 shadow-sm" : "border-transparent hover:border-border/70 hover:bg-white/60 dark:hover:bg-white/5"}`}>
                <button onClick={() => onSelectAIChat?.(ai)} className="flex min-w-0 flex-1 items-center gap-3 pr-2 text-left">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
                    {ai.avatar_url ? (
                      <img src={ai.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Bot className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium truncate block">{ai.name}</span>
                    <span className="text-xs text-muted-foreground truncate block">{ai.system_prompt?.slice(0, 40)}...</span>
                  </div>
                </button>
                <AIChatContextMenu
                  aiProfileId={ai.id}
                  aiName={ai.name}
                  onDelete={() => removeAIProfile(ai.id)}
                >
                  <button
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={`Open actions for ${ai.name}`}
                  >
                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                  </button>
                </AIChatContextMenu>
              </div>
            ))
          )
        ) : (
          /* Human Chats */
          <>
            {/* Back Button - when viewing archived chats */}
            {viewingArchivedChats && (
              <button
                onClick={() => setViewingArchivedChats(false)}
                className="group mx-2 mt-3 mb-2 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition duration-200 ease-out hover:bg-white/5 hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to chats
              </button>
            )}

            {showGlobalResults && (
              <>
                {searching ? (
                  <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                  </div>
                ) : searchResults.length > 0 ? (
                  <div>
                    <div className="section-label px-4 py-2">Users found</div>
                    {searchResults.map((p) => (
                      <div key={p.user_id} className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-[1.35rem] border border-transparent px-4 py-3 text-left transition-all hover:border-border/70 hover:bg-white/60 dark:hover:bg-white/5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent font-display text-sm font-semibold text-accent-foreground">
                          {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : sanitizeDisplayName(p.display_name).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium truncate block">{sanitizeDisplayName(p.display_name)}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">#{p.user_code}</span>
                        </div>
                        <RequestButton
                          state={conversationMap.has(p.user_id) ? "accepted" : getRequestStateForUser(p.user_id)}
                          loading={requestingUserId === p.user_id}
                          onSend={() => handleSendRequest(p)}
                          onOpen={() => {
                            if (openConversationWithUser(p.user_id)) {
                              setSearch("");
                              setSearchResults([]);
                            }
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">No users found</div>
                )}
                {filtered.length > 0 && (
                  <div className="section-label mt-2 border-t border-border/60 px-4 py-3">{viewingArchivedChats ? "Archived Chats" : "Your chats"}</div>
                )}
              </>
            )}

            {loading && !showGlobalResults ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Loading...</div>
            ) : !showGlobalResults && filtered.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{viewingArchivedChats ? "No archived conversations" : "No conversations yet"}</p>
                <p className="mt-1 text-xs text-muted-foreground/70">{viewingArchivedChats ? "Archived chats will appear here" : "Search for a user to start chatting"}</p>
              </div>
            ) : (
              filtered.map((conv) => (
                <div key={conv.id} className={`group relative mx-2 mt-2 flex w-auto items-center gap-3 rounded-[1.35rem] border px-3 py-3 text-left transition-all ${selectedConversation === conv.id ? "border-primary/20 bg-accent/70 shadow-sm" : "border-transparent hover:border-border/70 hover:bg-white/60 dark:hover:bg-white/5"}`}>
                  <button onClick={() => onSelectConversation(conv)} className="flex min-w-0 flex-1 items-center gap-3 pr-2 text-left">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-display text-sm font-semibold text-primary">
                      {conv.otherUser.avatar_url ? <img src={conv.otherUser.avatar_url} alt="" className="h-full w-full object-cover" /> : sanitizeDisplayName(conv.otherUser.display_name).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium truncate flex items-center gap-1">
                          {conv.is_pinned && <Pin className="h-3 w-3 text-muted-foreground inline-block" />}
                          {sanitizeDisplayName(conv.otherUser.display_name)}
                        </span>
                        {conv.lastMessage && (
                          <span className="shrink-0 pl-2 text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(conv.lastMessage.created_at), { addSuffix: false })}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                          {getMessagePreview(conv.lastMessage)}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-none text-primary-foreground">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  <ConversationContextMenu
                    conversationId={conv.id}
                    isPinned={conv.is_pinned}
                    isArchived={conv.is_archived}
                    otherUserName={conv.otherUser.display_name}
                    otherUserCode={conv.otherUser.user_code}
                    onUpdate={refetch}
                    onDelete={selectedConversation === conv.id ? () => onSelectConversation(null as any) : undefined}
                  >
                    <button
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={`Open actions for ${conv.otherUser.display_name}`}
                    >
                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </ConversationContextMenu>
                </div>
              ))
            )}
          </>
        )}
      </div>
      <Suspense fallback={null}>
        <AddContactDialog open={showAddContact} onOpenChange={setShowAddContact} onRequestSent={refreshRequests} />
      </Suspense>

      {/* Floating Action Button (FAB) inside the sidebar (anchored to sidebar) */}
      <div className="absolute bottom-4 right-4 z-40 pointer-events-auto" style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))', right: '1rem' }}>
        <button
          aria-label="Send chat request"
          title="New chat"
          onClick={() => setShowAddContact(true)}
          className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#25D366] text-primary-foreground shadow-lg transition-transform duration-150 hover:scale-105 active:scale-95 focus:outline-none"
          style={{ boxShadow: '0 8px 16px rgba(0,0,0,0.24)' }}
        >
          {/* Inner dark rounded square with smooth corners */}
          <div className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-[#0b1b12]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-[#25D366]">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>
      </div>
      <Suspense fallback={null}>
        <RequestsDialog
          open={showRequests}
          onOpenChange={setShowRequests}
          existingConversationMap={conversationMap}
          onDataChanged={async () => {
            await Promise.all([refetch(), refreshRequests()]);
          }}
          onOpenConversation={(conversation) => {
            onSelectConversation(conversation);
            setShowRequests(false);
          }}
        />
      </Suspense>
      <Suspense fallback={null}>
        <ProfileEditDialog open={showProfile} onOpenChange={setShowProfile} />
      </Suspense>
      <Suspense fallback={null}>
        <ProfileEditDialog open={showProfile} onOpenChange={setShowProfile} />
      </Suspense>
      <Suspense fallback={null}>
        <CreateAIChatDialog open={showCreateAI} onOpenChange={setShowCreateAI} onCreated={(p) => { setAiProfiles((prev) => [p as AIProfile, ...prev]); onSelectAIChat?.(p as AIProfile); }} />
      </Suspense>
    </div>
  );
};

export default ChatSidebar;
