import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations } from "@/hooks/useConversations";
import { toast } from "sonner";
import { Search, Send, Loader2, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ShareContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sharedUserName: string;
  sharedUserCode: string;
}

const ShareContactDialog = ({
  open,
  onOpenChange,
  sharedUserName,
  sharedUserCode,
}: ShareContactDialogProps) => {
  const { user } = useAuth();
  const { conversations } = useConversations();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);

  const filtered = conversations
    .filter((c) => !c.is_archived)
    .filter((c) =>
      c.otherUser.display_name.toLowerCase().includes(search.toLowerCase())
    );

  const toggle = (convId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(convId)) next.delete(convId);
      else next.add(convId);
      return next;
    });
  };

  const handleSend = async () => {
    if (!user || selected.size === 0) return;
    setSending(true);

    const message = `Hey! Check out this contact: ${sharedUserName} — Code: #${sharedUserCode}`;

    try {
      const inserts = Array.from(selected).map((convId) => ({
        conversation_id: convId,
        sender_id: user.id,
        content: message,
      }));

      const { error } = await supabase.from("messages").insert(inserts);
      if (error) throw error;

      toast.success(`Shared with ${selected.size} chat${selected.size > 1 ? "s" : ""}`);
      setSelected(new Set());
      setSearch("");
      onOpenChange(false);
    } catch {
      toast.error("Failed to share contact");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            Share <span className="text-primary">{sharedUserName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className="pl-9 bg-muted border-0"
          />
        </div>

        <div className="max-h-64 overflow-y-auto -mx-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-sm text-muted-foreground">
              <MessageCircle className="h-8 w-8 mb-2 opacity-40" />
              No contacts found
            </div>
          ) : (
            filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => toggle(conv.id)}
                className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-muted/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary overflow-hidden">
                  {conv.otherUser.avatar_url ? (
                    <img src={conv.otherUser.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    conv.otherUser.display_name.charAt(0).toUpperCase()
                  )}
                </div>
                <span className="flex-1 text-left text-sm font-medium truncate">
                  {conv.otherUser.display_name}
                </span>
                <Checkbox checked={selected.has(conv.id)} />
              </button>
            ))
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSend}
            disabled={selected.size === 0 || sending}
            className="w-full gap-2"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send to {selected.size || ""} contact{selected.size !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareContactDialog;
