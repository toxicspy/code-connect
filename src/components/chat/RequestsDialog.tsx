import { useMemo, useState } from "react";
import { Ban, Check, Inbox, Loader2, X } from "lucide-react";
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

interface RequestsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenConversation?: (conversation: ConversationWithDetails) => void;
  existingConversationMap: Map<string, ConversationWithDetails>;
  onDataChanged?: () => Promise<void> | void;
}

const RequestsDialog = ({
  open,
  onOpenChange,
  onOpenConversation,
  existingConversationMap,
  onDataChanged,
}: RequestsDialogProps) => {
  const { incomingRequests, loading, acceptRequest, rejectRequest } = useChatRequests();
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);

  const pendingRequests = useMemo(
    () => incomingRequests.filter((request) => request.status === "pending"),
    [incomingRequests],
  );

  const handleAccept = async (requestId: string, senderId: string) => {
    setBusyRequestId(requestId);
    const { data, error } = await acceptRequest(requestId);
    setBusyRequestId(null);

    if (error) {
      toast.error(error.message || "Failed to accept request");
      return;
    }

    await onDataChanged?.();
    toast.success("Chat request accepted");

    const existingConversation = existingConversationMap.get(senderId);
    const conversationId = (data as { conversation_id?: string } | null)?.conversation_id;

    if (existingConversation) {
      onOpenConversation?.(existingConversation);
      onOpenChange(false);
    } else if (conversationId) {
      await onDataChanged?.();
    }
  };

  const handleReject = async (requestId: string, shouldBlock = false) => {
    setBusyRequestId(requestId);
    const { error } = await rejectRequest(requestId, shouldBlock);
    setBusyRequestId(null);

    if (error) {
      toast.error(error.message || "Failed to update request");
      return;
    }

    toast.success(shouldBlock ? "User blocked and request rejected" : "Request rejected");
    await onDataChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Inbox className="h-5 w-5 text-primary" />
            Chat Requests
          </DialogTitle>
          <DialogDescription>
            Only accepted users can enter your direct chat list. Review incoming requests here.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading requests...
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/70 px-5 py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Inbox className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">No pending requests</p>
              <p className="mt-1 text-xs text-muted-foreground">New people need your approval before they can start chatting.</p>
            </div>
          ) : (
            pendingRequests.map((request) => {
              const profile = request.senderProfile;
              const name = sanitizeDisplayName(profile?.display_name, "Unknown user");
              const isBusy = busyRequestId === request.id;

              return (
                <div key={request.id} className="rounded-[1.4rem] border border-border bg-card/80 p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-display text-sm font-semibold text-primary">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {profile?.user_code ? `#${profile.user_code}` : "Anonymous user"} wants to chat with you.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-xl px-3"
                      disabled={isBusy}
                      onClick={() => void handleAccept(request.id, request.sender_id)}
                    >
                      {isBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                      Accept
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-xl px-3"
                      disabled={isBusy}
                      onClick={() => void handleReject(request.id, false)}
                    >
                      <X className="mr-1.5 h-4 w-4" />
                      Reject
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-xl border-rose-500/30 text-rose-600 hover:bg-rose-500/10 dark:text-rose-300"
                      disabled={isBusy}
                      onClick={() => void handleReject(request.id, true)}
                    >
                      <Ban className="mr-1.5 h-4 w-4" />
                      Block
                    </Button>
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

export default RequestsDialog;
