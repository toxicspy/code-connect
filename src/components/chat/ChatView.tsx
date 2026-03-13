import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMessages } from "@/hooks/useMessages";
import { ConversationWithDetails } from "@/hooks/useConversations";
import { Send, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

interface ChatViewProps {
  conversation: ConversationWithDetails | null;
  onBack?: () => void;
}

const ChatView = ({ conversation, onBack }: ChatViewProps) => {
  const { user } = useAuth();
  const { messages, loading, sendMessage } = useMessages(conversation?.id ?? null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input;
    setInput("");
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center chat-area-bg">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Send className="h-8 w-8 text-primary/40" />
        </div>
        <h3 className="mt-4 font-display text-lg font-semibold text-muted-foreground">
          Select a chat to start messaging
        </h3>
        <p className="mt-1 text-sm text-muted-foreground/60">
          Or add a new contact using their unique code
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b chat-header-bg px-4 py-3">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 md:hidden">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-semibold text-primary">
          {conversation.otherUser.display_name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h3 className="text-sm font-semibold">{conversation.otherUser.display_name}</h3>
          <p className="text-xs font-mono user-code-badge inline-block rounded px-1.5 py-0.5">
            #{conversation.otherUser.user_code}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto chat-area-bg px-4 py-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-8 text-sm text-muted-foreground">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center py-8 text-sm text-muted-foreground">
            No messages yet. Say hello! 👋
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex animate-message-in ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                    isMine
                      ? "chat-bubble-sent rounded-br-md"
                      : "chat-bubble-received rounded-bl-md"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      isMine ? "text-primary-foreground/60" : "text-muted-foreground"
                    }`}
                  >
                    {format(new Date(msg.created_at), "HH:mm")}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="border-t chat-input-bg px-4 py-3">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 bg-muted border-0"
          />
          <Button onClick={handleSend} disabled={!input.trim()} size="icon" className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
