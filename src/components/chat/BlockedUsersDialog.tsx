import { useState } from "react";
import { Ban, CheckCircle2, Loader2, ShieldBan } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ConversationWithDetails } from "@/hooks/useConversations";
import { useChatRequests } from "@/hooks/useChatRequests";
import { sanitizeDisplayName } from "@/lib/profile-utils";

interface BlockedUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingConversationMap: Map<string, ConversationWithDetails>;
  onOpenConversation?: (conversation: ConversationWithDetails) => void;
  onDataChanged?: () => Promise<void> | void;
}

const BlockedUsersDialog = ({
  open,
  onOpenChange,
  existingConversationMap,
  onOpenConversation,
  onDataChanged,
}: BlockedUsersDialogProps) => {
  const { blockedEntries, loading, unblockUser, unblockAndAcceptRequest } = useChatRequests();
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const handleUnblock = async (userId: string) => {
    setBusyUserId(userId);
    const { error } = await unblockUser(userId);
    setBusyUserId(null);

    if (error) {
      toast.error(error.message || "Failed to unblock user");
      return;
    }

    toast.success("User unblocked");
    await onDataChanged?.();
  };

  const handleUnblockAndAccept = async (requestId: string, senderId: string) => {
    setBusyUserId(senderId);
    const { data, error } = await unblockAndAcceptRequest(requestId);
    setBusyUserId(null);

    if (error) {
      toast.error(error.message || "Failed to accept request");
      return;
    }

    await onDataChanged?.();
    toast.success("User unblocked and request accepted");

    const existingConversation = existingConversationMap.get(senderId);
    if (existingConversation) {
      onOpenConversation?.(existingConversation);
      onOpenChange(false);
      return;
    }

    const acceptedConversationId = (data as { conversation_id?: string } | null)?.conversation_id;
    if (acceptedConversationId) {
      await onDataChanged?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <ShieldBan className="h-5 w-5 text-primary" />
            Blocked Users
          </DialogTitle>
          <DialogDescription>
            Review blocked users here. You can unblock them, and if a previous request exists, accept it again.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading blocked users...
            </div>
          ) : blockedEntries.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/70 px-5 py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShieldBan className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">No blocked users</p>
              <p className="mt-1 text-xs text-muted-foreground">Blocked people will appear here for easy review.</p>
            </div>
          ) : (
            blockedEntries.map((entry) => {
              const name = sanitizeDisplayName(entry.profile?.display_name, "Unknown user");
              const latestRequest = entry.latestRequest;
              const canAccept = Boolean(latestRequest && (latestRequest.status === "rejected" || latestRequest.status === "pending"));
              const isBusy = busyUserId === entry.userId;

              return (
                <div key={entry.userId} className="rounded-[1.4rem] border border-border bg-card/80 p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-display text-sm font-semibold text-primary">
                      {entry.profile?.avatar_url ? (
                        <img src={entry.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.profile?.user_code ? `#${entry.profile.user_code}` : "Anonymous user"}
                        {latestRequest ? ` • Last request: ${latestRequest.status}` : " • No saved request"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-xl px-3"
                      disabled={isBusy}
                      onClick={() => void handleUnblock(entry.userId)}
                    >
                      {isBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Ban className="mr-1.5 h-4 w-4" />}
                      Unblock
                    </Button>

                    {canAccept && latestRequest && (
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-xl px-3"
                        disabled={isBusy}
                        onClick={() => void handleUnblockAndAccept(latestRequest.id, entry.userId)}
                      >
                        <CheckCircle2 className="mr-1.5 h-4 w-4" />
                        Accept Request
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BlockedUsersDialog;
