import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatView from "@/components/chat/ChatView";
import AIChatView, { AIProfile } from "@/components/chat/AIChatView";
import BrandBadge from "@/components/BrandBadge";
import SettingsDialog from "@/components/SettingsDialog";
import ThemeToggle from "@/components/ThemeToggle";
import { ConversationWithDetails } from "@/hooks/useConversations";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import Auth from "./Auth";

type ChatMode = "human" | "ai";

const Index = () => {
  const { user, loading } = useAuth();
  const [selectedConv, setSelectedConv] = useState<ConversationWithDetails | null>(null);
  const [selectedAI, setSelectedAI] = useState<AIProfile | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>("human");
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [aiProfilesVersion, setAiProfilesVersion] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

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
    <div className="app-shell flex h-[100dvh] min-h-[100dvh] flex-col bg-background md:overflow-hidden">
      <div className="flex items-center justify-between border-b chat-header-bg px-4 py-3">
        <BrandBadge />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(true)}
            className="h-9 w-9 rounded-full border border-border/80 bg-card/80 backdrop-blur"
            aria-label="Open settings"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex">
        <div className={`w-full md:w-[380px] shrink-0 min-h-0 ${mobileShowChat ? "hidden md:flex" : "flex"} flex-col`}>
          <ChatSidebar
            selectedConversation={chatMode === "human" ? selectedConv?.id ?? null : null}
            selectedAIProfileId={chatMode === "ai" ? selectedAI?.id ?? null : null}
            aiProfilesVersion={aiProfilesVersion}
            onSelectConversation={handleSelectConv}
            onSelectAIChat={handleSelectAI}
          />
        </div>
        <div className={`flex-1 min-h-0 ${!mobileShowChat ? "hidden md:flex" : "flex"} flex-col`}>
          {chatMode === "ai" ? (
            <AIChatView
              aiProfile={selectedAI}
              onBack={() => setMobileShowChat(false)}
              onProfileUpdated={(profile) => {
                setSelectedAI(profile);
                setAiProfilesVersion((v) => v + 1);
              }}
            />
          ) : (
            <ChatView conversation={selectedConv} onBack={() => setMobileShowChat(false)} />
          )}
        </div>
      </div>
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
};

export default Index;
