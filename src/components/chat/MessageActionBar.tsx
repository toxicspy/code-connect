import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Share2, Forward, X, MoreVertical, Copy, Star, StarOff, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ForwardMessageDialog from "./ForwardMessageDialog";

interface MessageActionBarProps {
  selectedMessageIds: string[];
  messageContent: string;
  selectedCount: number;
  canCopy: boolean;
  canStar: boolean;
  canEdit: boolean;
  isStarred: boolean;
  chatType: "normal" | "ai";
  onDeselect: () => void;
  onDeleted: () => void;
  onDeleteMessages: (messageIds: string[]) => Promise<{ error: unknown }>;
  onStarToggled: () => void;
  onEditRequested?: () => void;
}

const MessageActionBar = ({
  selectedMessageIds,
  messageContent,
  selectedCount,
  canCopy,
  canStar,
  canEdit,
  isStarred,
  chatType,
  onDeselect,
  onDeleted,
  onDeleteMessages,
  onStarToggled,
  onEditRequested,
}: MessageActionBarProps) => {
  const { user } = useAuth();
  const [showForward, setShowForward] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleCopy = () => {
    if (!canCopy) return;
    navigator.clipboard.writeText(messageContent);
    toast.success("Copied to clipboard");
    onDeselect();
  };

  const handleDelete = async () => {
    if (!user || deleting) return;
    setDeleting(true);
    const { error } = await onDeleteMessages(selectedMessageIds);
    if (error) {
      toast.error("Failed to delete message");
    } else {
      toast.success(selectedCount === 1 ? "Message deleted" : `${selectedCount} messages deleted`);
      onDeleted();
    }
    setDeleting(false);
  };

  const handleStar = async () => {
    if (!user || !canStar || selectedMessageIds.length !== 1) return;
    const selectedMessageId = selectedMessageIds[0];
    if (isStarred) {
      const column = chatType === "ai" ? "ai_message_id" : "message_id";
      await supabase.from("starred_messages").delete().eq("user_id", user.id).eq(column, selectedMessageId);
      toast.success("Unstarred");
    } else {
      const insert: { user_id: string; ai_message_id?: string; message_id?: string } = { user_id: user.id };
      if (chatType === "ai") insert.ai_message_id = selectedMessageId;
      else insert.message_id = selectedMessageId;
      await supabase.from("starred_messages").insert(insert);
      toast.success("Starred");
    }
    onStarToggled();
  };

  return (
    <>
      <div className="animate-in slide-in-from-top-2 flex items-center gap-1 border-b bg-primary px-3 py-2 duration-200">
        <Button variant="ghost" size="icon" onClick={onDeselect} className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20">
          <X className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium text-primary-foreground">{selectedCount} selected</span>
        <div className="flex-1" />

        <Button variant="ghost" size="icon" onClick={handleDelete} disabled={deleting} className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20" title="Delete">
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setShowForward(true)} className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20" title="Forward">
          <Forward className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setShowForward(true)} className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20" title="Share">
          <Share2 className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={handleCopy} disabled={!canCopy}>
              <Copy className="mr-2 h-4 w-4" /> Copy
            </DropdownMenuItem>
            {chatType === "normal" && (
              <DropdownMenuItem onClick={onEditRequested} disabled={!canEdit}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleStar} disabled={!canStar}>
              {isStarred ? (
                <>
                  <StarOff className="mr-2 h-4 w-4" /> Unstar
                </>
              ) : (
                <>
                  <Star className="mr-2 h-4 w-4" /> Star
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ForwardMessageDialog
        open={showForward}
        onOpenChange={(open) => {
          setShowForward(open);
          if (!open) onDeselect();
        }}
        messageContent={messageContent}
      />
    </>
  );
};

export default MessageActionBar;
