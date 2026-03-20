import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Trash2, Share2, Forward, X, MoreVertical, Copy, Star, StarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ForwardMessageDialog from "./ForwardMessageDialog";

interface MessageActionBarProps {
  selectedMessageId: string;
  messageContent: string;
  isMine: boolean;
  isStarred: boolean;
  /** "normal" for human chats, "ai" for AI chats */
  chatType: "normal" | "ai";
  onDeselect: () => void;
  onDeleted: () => void;
  onStarToggled: () => void;
}

const MessageActionBar = ({
  selectedMessageId,
  messageContent,
  isMine,
  isStarred,
  chatType,
  onDeselect,
  onDeleted,
  onStarToggled,
}: MessageActionBarProps) => {
  const { user } = useAuth();
  const [showForward, setShowForward] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(messageContent);
    toast.success("Copied to clipboard");
    onDeselect();
  };

  const handleDelete = async () => {
    if (!user || deleting) return;
    setDeleting(true);
    const table = chatType === "ai" ? "ai_chat_messages" : "messages";
    const { error } = await supabase.from(table).delete().eq("id", selectedMessageId);
    if (error) {
      toast.error("Failed to delete message");
    } else {
      toast.success("Message deleted");
      onDeleted();
    }
    setDeleting(false);
  };

  const handleStar = async () => {
    if (!user) return;
    if (isStarred) {
      const col = chatType === "ai" ? "ai_message_id" : "message_id";
      await supabase.from("starred_messages").delete().eq("user_id", user.id).eq(col, selectedMessageId);
      toast.success("Unstarred");
    } else {
      const insert: any = { user_id: user.id };
      if (chatType === "ai") insert.ai_message_id = selectedMessageId;
      else insert.message_id = selectedMessageId;
      await supabase.from("starred_messages").insert(insert);
      toast.success("Starred");
    }
    onStarToggled();
  };

  return (
    <>
      <div className="flex items-center gap-1 border-b bg-primary px-3 py-2 animate-in slide-in-from-top-2 duration-200">
        <Button variant="ghost" size="icon" onClick={onDeselect} className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20">
          <X className="h-4 w-4" />
        </Button>
        <div className="flex-1" />

        {isMine && (
          <Button variant="ghost" size="icon" onClick={handleDelete} disabled={deleting} className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20" title="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
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
            <DropdownMenuItem onClick={handleCopy}>
              <Copy className="mr-2 h-4 w-4" /> Copy
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleStar}>
              {isStarred ? (
                <><StarOff className="mr-2 h-4 w-4" /> Unstar</>
              ) : (
                <><Star className="mr-2 h-4 w-4" /> Star</>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ForwardMessageDialog
        open={showForward}
        onOpenChange={(open) => { setShowForward(open); if (!open) onDeselect(); }}
        messageContent={messageContent}
      />
    </>
  );
};

export default MessageActionBar;
