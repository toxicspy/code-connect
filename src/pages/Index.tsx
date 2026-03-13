import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatView from "@/components/chat/ChatView";
import { ConversationWithDetails } from "@/hooks/useConversations";
import Auth from "./Auth";

const Index = () => {
  const { user, loading } = useAuth();
  const [selectedConv, setSelectedConv] = useState<ConversationWithDetails | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Auth />;

  const handleSelect = (conv: ConversationWithDetails) => {
    setSelectedConv(conv);
    setMobileShowChat(true);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - hidden on mobile when chat is open */}
      <div className={`w-full md:w-[380px] shrink-0 ${mobileShowChat ? "hidden md:flex" : "flex"} flex-col`}>
        <ChatSidebar
          selectedConversation={selectedConv?.id ?? null}
          onSelectConversation={handleSelect}
        />
      </div>

      {/* Chat view */}
      <div className={`flex-1 ${!mobileShowChat ? "hidden md:flex" : "flex"} flex-col`}>
        <ChatView
          conversation={selectedConv}
          onBack={() => setMobileShowChat(false)}
        />
      </div>
    </div>
  );
};

export default Index;
