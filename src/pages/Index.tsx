import { lazy, Suspense, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import BrandBadge from "@/components/BrandBadge";
import ThemeToggle from "@/components/ThemeToggle";
import { ConversationWithDetails } from "@/hooks/useConversations";
import { Button } from "@/components/ui/button";
import { Settings, LogOut } from "lucide-react";
import type { AIProfile } from "@/components/chat/AIChatView";

const ChatSidebar = lazy(() => import("@/components/chat/ChatSidebar"));
const ChatView = lazy(() => import("@/components/chat/ChatView"));
const AIChatView = lazy(() => import("@/components/chat/AIChatView"));
const SettingsDialog = lazy(() => import("@/components/SettingsDialog"));
const Auth = lazy(() => import("./Auth"));

type ChatMode = "human" | "ai";

const PanelFallback = () => (
  <div className="flex h-full min-h-0 items-center justify-center bg-transparent">
    <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const Index = () => {
  const { user, loading, signOut } = useAuth();
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

  if (!user) {
    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
        <Auth />
      </Suspense>
    );
  }

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
    <div className="app-shell relative flex h-[100dvh] min-h-[100dvh] flex-col md:overflow-hidden">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.14),transparent_24%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_28%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.14),transparent_24%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.14),transparent_28%)]" />
      <div className="relative z-10 flex items-center justify-between bg-background/90 px-4 py-3 shadow-sm backdrop-blur-sm md:px-6">
        <BrandBadge />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(true)}
            className="h-10 w-10 rounded-sm bg-background/85 text-foreground hover:bg-background dark:bg-background/80"
            aria-label="Open settings"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="h-10 w-10 rounded-sm bg-background/85 text-foreground hover:bg-background dark:bg-background/80"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="relative z-10 flex min-h-0 flex-1 p-3 md:p-5 mt-4 md:mt-6">
        <div className="panel-surface absolute inset-x-3 bottom-3 top-0 -z-10 rounded-sm md:inset-x-5 md:bottom-5" />
        <div
          className={`panel-surface w-full shrink-0 min-h-0 ${mobileShowChat ? "hidden md:flex" : "flex"} flex-col overflow-hidden rounded-sm md:w-[390px]`}
        >
          <Suspense fallback={<PanelFallback />}>
            <ChatSidebar
              selectedConversation={chatMode === "human" ? selectedConv?.id ?? null : null}
              selectedAIProfileId={chatMode === "ai" ? selectedAI?.id ?? null : null}
              aiProfilesVersion={aiProfilesVersion}
              onSelectConversation={handleSelectConv}
              onSelectAIChat={handleSelectAI}
            />
          </Suspense>
        </div>
        <div
          className={`panel-surface flex-1 min-h-0 ${!mobileShowChat ? "hidden md:flex" : "flex"} flex-col overflow-hidden rounded-sm md:ml-4`}
        >
          <Suspense fallback={<PanelFallback />}>
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
          </Suspense>
        </div>
      </div>
      {/* FAB moved to ChatSidebar (contact list) */}
      <Suspense fallback={null}>
        <SettingsDialog open={showSettings} onOpenChange={setShowSettings} currentConversation={chatMode === "human" ? selectedConv : null} />
      </Suspense>
    </div>
  );
};

export default Index;
