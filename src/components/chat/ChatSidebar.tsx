import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations, ConversationWithDetails } from "@/hooks/useConversations";
import { supabase } from "@/integrations/supabase/client";
import { Search, UserPlus, LogOut, Copy, MessageCircle, Loader2, MoreVertical, Archive, Pin, Bot, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import AddContactDialog from "./AddContactDialog";
import ProfileEditDialog from "./ProfileEditDialog";
import ConversationContextMenu from "./ConversationContextMenu";
import CreateAIChatDialog from "./CreateAIChatDialog";
import type { Tables } from "@/integrations/supabase/types";
import type { AIProfile } from "./AIChatView";

type Profile = Tables<"profiles">;

interface ChatSidebarProps {
  selectedConversation: string | null;
  selectedAIProfileId?: string | null;
  onSelectConversation: (conv: ConversationWithDetails) => void;
  onSelectAIChat?: (profile: AIProfile) => void;
}

const ChatSidebar = ({ selectedConversation, selectedAIProfileId, onSelectConversation, onSelectAIChat }: ChatSidebarProps) => {
  const { user, profile, signOut } = useAuth();
  const { conversations, loading, refetch } = useConversations();
  const [search, setSearch] = useState("");
  const [showAddContact, setShowAddContact] = useState(false);
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [startingChat, setStartingChat] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showCreateAI, setShowCreateAI] = useState(false);
  const [aiProfiles, setAiProfiles] = useState<AIProfile[]>([]);
  const [tab, setTab] = useState<"chats" | "ai">("chats");

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
  }, [user]);

  // Debounced global user search
  useEffect(() => {
    if (!search.trim() || !user) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const term = search.trim();
      const upperTerm = term.toUpperCase();
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .neq("user_id", user.id)
        .or(`display_name.ilike.%${term}%,user_code.eq.${upperTerm}`);
      setSearchResults(data || []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, user]);

  const startChatWith = useCallback(async (targetProfile: Profile) => {
    if (!user) return;
    setStartingChat(targetProfile.user_id);
    try {
      const { data: myConvs } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", user.id);
      const { data: theirConvs } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", targetProfile.user_id);
      const myIds = new Set(myConvs?.map((c) => c.conversation_id));
      const sharedConv = theirConvs?.find((c) => myIds.has(c.conversation_id));
      let convId: string;
      if (sharedConv) {
        convId = sharedConv.conversation_id;
      } else {
        convId = crypto.randomUUID();
        const { error: convError } = await supabase.from("conversations").insert({ id: convId });
        if (convError) throw convError;
        const { error: e1 } = await supabase.from("conversation_participants").insert({ conversation_id: convId, user_id: user.id });
        if (e1) throw e1;
        const { error: e2 } = await supabase.from("conversation_participants").insert({ conversation_id: convId, user_id: targetProfile.user_id });
        if (e2) throw e2;
        const { data: existing } = await supabase.from("contacts").select("id").eq("user_id", user.id).eq("contact_user_id", targetProfile.user_id).maybeSingle();
        if (!existing) await supabase.from("contacts").insert({ user_id: user.id, contact_user_id: targetProfile.user_id });
      }
      await refetch();
      onSelectConversation({ id: convId, otherUser: targetProfile, updated_at: new Date().toISOString(), is_pinned: false, is_archived: false });
      setSearch("");
      setSearchResults([]);
    } catch (err: any) {
      toast.error(err.message || "Failed to start chat");
    } finally {
      setStartingChat(null);
    }
  }, [user, refetch, onSelectConversation]);

  const deleteAIProfile = async (id: string) => {
    const { error } = await supabase.from("ai_chat_profiles").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    setAiProfiles((prev) => prev.filter((p) => p.id !== id));
    toast.success("AI chat deleted");
  };

  const filtered = conversations
    .filter((c) => (showArchived ? c.is_archived : !c.is_archived))
    .filter((c) => c.otherUser.display_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return 0;
    });

  const copyCode = () => {
    if (profile?.user_code) {
      navigator.clipboard.writeText(profile.user_code);
      toast.success("Code copied!");
    }
  };

  const showGlobalResults = search.trim().length > 0 && tab === "chats";

  return (
    <div className="flex h-full flex-col border-r bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <button onClick={() => setShowProfile(true)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary overflow-hidden">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <MessageCircle className="h-4 w-4 text-primary-foreground" />
            )}
          </div>
          <div className="text-left">
            <h2 className="font-display text-sm font-semibold">{profile?.display_name}</h2>
            <button onClick={copyCode} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-mono user-code-badge transition-colors hover:opacity-80">
              #{profile?.user_code}
              <Copy className="h-3 w-3" />
            </button>
          </div>
        </button>
        <div className="flex gap-1">
          {tab === "chats" && (
            <Button variant="ghost" size="icon" onClick={() => setShowArchived(!showArchived)} className={`h-8 w-8 ${showArchived ? "text-primary" : ""}`} title={showArchived ? "Show chats" : "Show archived"}>
              <Archive className="h-4 w-4" />
            </Button>
          )}
          {tab === "chats" && (
            <Button variant="ghost" size="icon" onClick={() => setShowAddContact(true)} className="h-8 w-8">
              <UserPlus className="h-4 w-4" />
            </Button>
          )}
          {tab === "ai" && (
            <Button variant="ghost" size="icon" onClick={() => setShowCreateAI(true)} className="h-8 w-8" title="New AI Chat">
              <Plus className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setTab("chats")}
          className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${tab === "chats" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          <MessageCircle className="h-3.5 w-3.5 inline-block mr-1" />
          Chats
        </button>
        <button
          onClick={() => setTab("ai")}
          className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${tab === "ai" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Bot className="h-3.5 w-3.5 inline-block mr-1" />
          AI Chats
        </button>
      </div>

      {/* Search (chats tab only) */}
      {tab === "chats" && (
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users by name or code..." className="pl-9 bg-muted border-0" />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
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
              <div
                key={ai.id}
                className={`group relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${selectedAIProfileId === ai.id ? "bg-accent" : ""}`}
              >
                <button onClick={() => onSelectAIChat?.(ai)} className="flex flex-1 items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium truncate block">{ai.name}</span>
                    <span className="text-xs text-muted-foreground truncate block">{ai.system_prompt?.slice(0, 40)}...</span>
                  </div>
                </button>
                <button
                  onClick={() => deleteAIProfile(ai.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10"
                  title="Delete AI chat"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
            ))
          )
        ) : (
          /* Human Chats */
          <>
            {showGlobalResults && (
              <>
                {searching ? (
                  <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                  </div>
                ) : searchResults.length > 0 ? (
                  <div>
                    <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Users found</div>
                    {searchResults.map((p) => (
                      <button key={p.user_id} onClick={() => startChatWith(p)} disabled={startingChat === p.user_id} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent font-display text-sm font-semibold text-accent-foreground overflow-hidden">
                          {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : p.display_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium truncate block">{p.display_name}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">#{p.user_code}</span>
                        </div>
                        {startingChat === p.user_id ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <MessageCircle className="h-4 w-4 text-primary" />}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">No users found</div>
                )}
                {filtered.length > 0 && (
                  <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-t mt-2 pt-2">Your chats</div>
                )}
              </>
            )}

            {loading && !showGlobalResults ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Loading...</div>
            ) : !showGlobalResults && filtered.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No conversations yet</p>
                <p className="mt-1 text-xs text-muted-foreground/70">Search for a user to start chatting</p>
              </div>
            ) : (
              filtered.map((conv) => (
                <div key={conv.id} className={`group relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${selectedConversation === conv.id ? "bg-accent" : ""}`}>
                  <button onClick={() => onSelectConversation(conv)} className="flex flex-1 items-center gap-3 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-semibold text-primary overflow-hidden">
                      {conv.otherUser.avatar_url ? <img src={conv.otherUser.avatar_url} alt="" className="h-full w-full object-cover" /> : conv.otherUser.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate flex items-center gap-1">
                          {conv.is_pinned && <Pin className="h-3 w-3 text-muted-foreground inline-block" />}
                          {conv.otherUser.display_name}
                        </span>
                        {conv.lastMessage && <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(conv.lastMessage.created_at), { addSuffix: false })}</span>}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{conv.lastMessage?.content || "No messages yet"}</p>
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
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted">
                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </ConversationContextMenu>
                </div>
              ))
            )}
          </>
        )}
      </div>

      <AddContactDialog open={showAddContact} onOpenChange={setShowAddContact} />
      <ProfileEditDialog open={showProfile} onOpenChange={setShowProfile} />
      <CreateAIChatDialog open={showCreateAI} onOpenChange={setShowCreateAI} onCreated={(p) => { setAiProfiles((prev) => [p as AIProfile, ...prev]); onSelectAIChat?.(p as AIProfile); }} />
    </div>
  );
};

export default ChatSidebar;
