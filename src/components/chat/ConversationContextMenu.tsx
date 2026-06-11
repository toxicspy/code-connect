import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Pin, PinOff, Archive, ArchiveRestore, Trash2, Share2, Ban } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ShareContactDialog from "./ShareContactDialog";

interface ConversationContextMenuProps {
  children: React.ReactNode;
  conversationId: string;
  isPinned: boolean;
  isArchived: boolean;
  otherUserName: string;
  otherUserCode: string;
  otherUserId: string;
  onUpdate: () => void;
  onDelete?: () => void;
}

const ConversationContextMenu = ({
  children,
  conversationId,
  isPinned,
  isArchived,
  otherUserName,
  otherUserCode,
  otherUserId,
  onUpdate,
  onDelete,
}: ConversationContextMenuProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [checkingBlock, setCheckingBlock] = useState(false);

  const togglePin = async () => {
    if (!user || loading) return;
    setLoading(true);
    const { error } = await supabase
      .from("conversation_participants")
      .update({ is_pinned: !isPinned })
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);
    if (error) toast.error("Failed to update");
    else toast.success(isPinned ? "Unpinned" : "Pinned");
    onUpdate();
    setLoading(false);
  };

  const toggleArchive = async () => {
    if (!user || loading) return;
    setLoading(true);
    const { error } = await supabase
      .from("conversation_participants")
      .update({ is_archived: !isArchived })
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);
    if (error) toast.error("Failed to update");
    else toast.success(isArchived ? "Unarchived" : "Archived");
    onUpdate();
    setLoading(false);
  };

  const deleteChat = async () => {
    if (!user || loading) return;
    setLoading(true);
    const { error } = await supabase
      .from("conversation_participants")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);
    if (error) toast.error("Failed to delete chat");
    else {
      toast.success("Chat deleted");
      onDelete?.();
    }
    onUpdate();
    setLoading(false);
  };

  const toggleBlock = async () => {
    if (!user || loading) return;
    setLoading(true);
    try {
      if (isBlocked) {
        const { error } = await supabase.rpc("unblock_chat_user", {
          _blocked_user_id: otherUserId,
        });
        if (error) throw error;
        setIsBlocked(false);
        toast.success("User unblocked");
      } else {
        const { error } = await supabase.rpc("block_chat_user", {
          _blocked_user_id: otherUserId,
        });
        if (error) throw error;
        setIsBlocked(true);
        toast.success("User blocked");
      }
      onUpdate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update block status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={togglePin} disabled={loading}>
            {isPinned ? (
              <>
                <PinOff className="mr-2 h-4 w-4" /> Unpin
              </>
            ) : (
              <>
                <Pin className="mr-2 h-4 w-4" /> Pin
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleArchive} disabled={loading}>
            {isArchived ? (
              <>
                <ArchiveRestore className="mr-2 h-4 w-4" /> Unarchive
              </>
            ) : (
              <>
                <Archive className="mr-2 h-4 w-4" /> Archive
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowShare(true)}>
            <Share2 className="mr-2 h-4 w-4" /> Share
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleBlock} disabled={loading}>
            <Ban className="mr-2 h-4 w-4" /> {isBlocked ? "Unblock" : "Block"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={deleteChat} disabled={loading} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Delete chat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ShareContactDialog
        open={showShare}
        onOpenChange={setShowShare}
        sharedUserName={otherUserName}
        sharedUserCode={otherUserCode}
      />
    </>
  );
};

export default ConversationContextMenu;
