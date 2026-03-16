import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatView from "@/components/chat/ChatView";
import AIChatView, { AIProfile } from "@/components/chat/AIChatView";
import { ConversationWithDetails } from "@/hooks/useConversations";
import Auth from "./Auth";

type ChatMode = "human" | "ai";

const Index = () => {
  const { user, loading } = useAuth();
  const [selectedConv, setSelectedConv] = useState<ConversationWithDetails | null>(null);
  const [selectedAI, setSelectedAI] = useState<AIProfile | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>("human");
  const [mobileShowChat, setMobileShowChat] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Auth />;

  const handleSelectConv = (conv: ConversationWithDetails) => {
    setSelectedConv(conv);
    setSelectedAI(null);
    setChatMode("human");
    setMobileShowChat(true);
  };

  const handleSelectAI = (profile: AIProfile) => {
    setSelectedAI(profile);
    setSelectedConv(null);
    setChatMode("ai");
    setMobileShowChat(true);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className={`w-full md:w-[380px] shrink-0 ${mobileShowChat ? "hidden md:flex" : "flex"} flex-col`}>
        <ChatSidebar
          selectedConversation={chatMode === "human" ? selectedConv?.id ?? null : null}
          selectedAIProfileId={chatMode === "ai" ? selectedAI?.id ?? null : null}
          onSelectConversation={handleSelectConv}
          onSelectAIChat={handleSelectAI}
        />
      </div>
      <div className={`flex-1 ${!mobileShowChat ? "hidden md:flex" : "flex"} flex-col`}>
        {chatMode === "ai" ? (
          <AIChatView aiProfile={selectedAI} onBack={() => setMobileShowChat(false)} />
        ) : (
          <ChatView conversation={selectedConv} onBack={() => setMobileShowChat(false)} />
        )}
      </div>
    </div>
  );
};

export default Index;
