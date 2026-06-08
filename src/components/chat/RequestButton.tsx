import { Loader2, Send, ShieldBan, CheckCircle2, Clock3, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatRequestState } from "@/hooks/useChatRequests";

interface RequestButtonProps {
  state: ChatRequestState;
  loading?: boolean;
  onSend: () => void | Promise<void>;
  onOpen?: () => void;
}

const RequestButton = ({ state, loading = false, onSend, onOpen }: RequestButtonProps) => {
  if (state === "accepted") {
    return (
      <Button type="button" size="sm" className="rounded-xl px-3" onClick={onOpen}>
        <CheckCircle2 className="mr-1.5 h-4 w-4" />
        Open
      </Button>
    );
  }

  if (state === "pending_sent") {
    return (
      <Button type="button" size="sm" variant="outline" className="rounded-xl px-3" disabled>
        <Clock3 className="mr-1.5 h-4 w-4" />
        Request Sent
      </Button>
    );
  }

  if (state === "pending_received") {
    return (
      <Button type="button" size="sm" variant="outline" className="rounded-xl px-3" disabled>
        <Inbox className="mr-1.5 h-4 w-4" />
        Check Requests
      </Button>
    );
  }

  if (state === "blocked") {
    return (
      <Button type="button" size="sm" variant="outline" className="rounded-xl px-3" disabled>
        <ShieldBan className="mr-1.5 h-4 w-4" />
        Blocked
      </Button>
    );
  }

  return (
    <Button type="button" size="sm" className="rounded-xl px-3" disabled={loading} onClick={() => void onSend()}>
      {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
      Send Request
    </Button>
  );
};

export default RequestButton;
