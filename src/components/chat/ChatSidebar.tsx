import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations, ConversationWithDetails } from "@/hooks/useConversations";
import { Search, UserPlus, LogOut, Copy, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import AddContactDialog from "./AddContactDialog";

interface ChatSidebarProps {
  selectedConversation: string | null;
  onSelectConversation: (conv: ConversationWithDetails) => void;
}

const ChatSidebar = ({ selectedConversation, onSelectConversation }: ChatSidebarProps) => {
  const { profile, signOut } = useAuth();
  const { conversations, loading } = useConversations();
  const [search, setSearch] = useState("");
  const [showAddContact, setShowAddContact] = useState(false);

  const filtered = conversations.filter((c) =>
    c.otherUser.display_name.toLowerCase().includes(search.toLowerCase())
  );

  const copyCode = () => {
    if (profile?.user_code) {
      navigator.clipboard.writeText(profile.user_code);
      toast.success("Code copied!");
    }
  };

  return (
    <div className="flex h-full flex-col border-r bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
            <MessageCircle className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-display text-sm font-semibold">{profile?.display_name}</h2>
            <button
              onClick={copyCode}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-mono user-code-badge transition-colors hover:opacity-80"
            >
              #{profile?.user_code}
              <Copy className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => setShowAddContact(true)} className="h-8 w-8">
            <UserPlus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="pl-9 bg-muted border-0"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No conversations yet</p>
            <p className="mt-1 text-xs text-muted-foreground/70">Add a contact to start chatting</p>
          </div>
        ) : (
          filtered.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelectConversation(conv)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                selectedConversation === conv.id ? "bg-accent" : ""
              }`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-semibold text-primary">
                {conv.otherUser.display_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{conv.otherUser.display_name}</span>
                  {conv.lastMessage && (
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(conv.lastMessage.created_at), { addSuffix: false })}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {conv.lastMessage?.content || "No messages yet"}
                </p>
              </div>
            </button>
          ))
        )}
      </div>

      <AddContactDialog open={showAddContact} onOpenChange={setShowAddContact} />
    </div>
  );
};

export default ChatSidebar;
