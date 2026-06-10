import { MessageSquare, Users, Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyChatsStateProps {
  onSendChatRequest?: () => void;
  onViewRequests?: () => void;
  onSearchFriends?: () => void;
}

export function EmptyChatsState({
  onSendChatRequest,
  onViewRequests,
  onSearchFriends,
}: EmptyChatsStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center chat-area-bg px-6">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
        <MessageSquare className="h-12 w-12 text-primary/50" />
      </div>

      <h2 className="mt-6 font-display text-2xl font-semibold text-foreground">
        👋 Welcome to Chat
      </h2>

      <p className="mt-2 text-center text-base text-muted-foreground">
        You don't have any conversations yet.
      </p>

      <div className="mt-6 space-y-3 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          To get started:
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground/80">
          <li className="flex items-center justify-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/50" />
            Send a chat request to a friend
          </li>
          <li className="flex items-center justify-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/50" />
            Accept an incoming chat request
          </li>
          <li className="flex items-center justify-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/50" />
            Search for users by name or user code
          </li>
        </ul>
      </div>

      <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <Button
          onClick={onSendChatRequest}
          className="gap-2"
          size="lg"
        >
          <Plus className="h-4 w-4" />
          Send Chat Request
        </Button>
        <Button
          onClick={onViewRequests}
          variant="secondary"
          className="gap-2"
          size="lg"
        >
          <Users className="h-4 w-4" />
          View Requests
        </Button>
      </div>

      <p className="mt-6 max-w-sm text-center text-xs text-muted-foreground/60">
        Once a chat request is accepted, your conversations will appear here and
        you can start messaging.
      </p>
    </div>
  );
}
