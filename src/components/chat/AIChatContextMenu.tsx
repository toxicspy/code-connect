import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Trash2, Share2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ShareAIChatDialog from "./ShareAIChatDialog";

interface AIChatContextMenuProps {
  children: React.ReactNode;
  aiProfileId: string;
  aiName: string;
  onDelete: () => void;
}

const AIChatContextMenu = ({
  children,
  aiProfileId,
  aiName,
  onDelete,
}: AIChatContextMenuProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const deleteProfile = async () => {
    if (!user || loading) return;
    setLoading(true);
    // Delete messages first, then profile
    await supabase.from("ai_chat_messages").delete().eq("ai_profile_id", aiProfileId).eq("user_id", user.id);
    const { error } = await supabase.from("ai_chat_profiles").delete().eq("id", aiProfileId).eq("user_id", user.id);
    if (error) toast.error("Failed to delete");
    else {
      toast.success("AI chat deleted");
      onDelete();
    }
    setLoading(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setShowShare(true)}>
            <Share2 className="mr-2 h-4 w-4" /> Share
          </DropdownMenuItem>
          <DropdownMenuItem onClick={deleteProfile} disabled={loading} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ShareAIChatDialog
        open={showShare}
        onOpenChange={setShowShare}
        aiName={aiName}
      />
    </>
  );
};

export default AIChatContextMenu;
