import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Palette, Settings2, ShieldBan, ShieldCheck } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme, type ThemeColor } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { ConversationWithDetails } from "@/hooks/useConversations";
import SafetyNumberDialog from "@/components/chat/SafetyNumberDialog";
import BlockedUsersDialog from "@/components/chat/BlockedUsersDialog";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentConversation?: ConversationWithDetails | null;
  existingConversationMap?: Map<string, ConversationWithDetails>;
  onOpenConversation?: (conversation: ConversationWithDetails) => void;
}

type SettingsView = "menu" | "theme";

const colorOptions: Array<{ id: ThemeColor; label: string; swatch: string }> = [
  { id: "green", label: "Green", swatch: "hsl(160 84% 39%)" },
  { id: "blue", label: "Blue", swatch: "hsl(212 95% 52%)" },
  { id: "purple", label: "Purple", swatch: "hsl(270 76% 56%)" },
  { id: "red", label: "Red", swatch: "hsl(355 84% 58%)" },
  { id: "orange", label: "Orange", swatch: "hsl(28 96% 52%)" },
];

const SettingsDialog = ({
  open,
  onOpenChange,
  currentConversation = null,
  existingConversationMap = new Map(),
  onOpenConversation,
}: SettingsDialogProps) => {
  const { theme, setTheme, themeColor, setThemeColor } = useTheme();
  const { identityFingerprint, refreshIdentityFingerprint } = useAuth();
  const [view, setView] = useState<SettingsView>("menu");
  const [safetyDialogOpen, setSafetyDialogOpen] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [otherUserFingerprint, setOtherUserFingerprint] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setView("menu");
    }
  }, [open]);

  useEffect(() => {
    if (!currentConversation?.otherUser.user_id) {
      setOtherUserFingerprint(null);
      return;
    }

    let cancelled = false;

    const fetchOtherIdentityFingerprint = async () => {
      const { data } = await supabase
        .from("user_encryption_identities")
        .select("fingerprint")
        .eq("user_id", currentConversation.otherUser.user_id)
        .maybeSingle();

      if (!cancelled) {
        setOtherUserFingerprint(data?.fingerprint ?? null);
      }
    };

    void fetchOtherIdentityFingerprint();

    return () => {
      cancelled = true;
    };
  }, [currentConversation?.otherUser.user_id]);

  const title = useMemo(() => (view === "menu" ? "Settings" : "Colour Theme"), [view]);
  const description = useMemo(() => {
    if (view === "theme") {
      return "Choose your app color and light or dark appearance.";
    }
    return "Choose what you want to manage.";
  }, [view]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-auto bottom-0 max-w-none translate-x-[-50%] translate-y-0 rounded-t-3xl rounded-b-none border-b-0 px-5 pb-6 pt-5 sm:top-[50%] sm:max-w-md sm:translate-y-[-50%] sm:rounded-2xl sm:border-b">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2 font-display text-left">
            {view === "theme" ? (
              <button
                type="button"
                onClick={() => setView("menu")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-accent"
                aria-label="Back to settings"
              >
                <ArrowLeft className="h-4 w-4 text-primary" />
              </button>
            ) : (
              <Settings2 className="h-5 w-5 text-primary" />
            )}
            {title}
          </DialogTitle>
          <DialogDescription className="text-left">
            {description}
          </DialogDescription>
        </DialogHeader>

        {view === "menu" ? (
          <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-3">
            <button
              type="button"
              onClick={() => setView("theme")}
              className="flex w-full items-center justify-between rounded-2xl border bg-card px-4 py-4 text-left transition-all hover:border-primary/40 hover:bg-accent/40"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Palette className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Colour Theme</p>
                  <p className="text-xs text-muted-foreground">Open theme color and light/dark settings.</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              disabled={!currentConversation}
              onClick={() => setSafetyDialogOpen(true)}
              className="flex w-full items-center justify-between rounded-2xl border bg-card px-4 py-4 text-left transition-all hover:border-primary/40 hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Verify Safety Number</p>
                  <p className="text-xs text-muted-foreground">
                    {currentConversation
                      ? `Compare fingerprints with ${currentConversation.otherUser.display_name}.`
                      : "Open a chat first to verify that contact."}
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setShowBlockedUsers(true)}
              className="flex w-full items-center justify-between rounded-2xl border bg-card px-4 py-4 text-left transition-all hover:border-primary/40 hover:bg-accent/40"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ShieldBan className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Blocked Users</p>
                  <p className="text-xs text-muted-foreground">Review and unblock users you’ve blocked from chatting.</p>
                </div>
              </div>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Theme Color</h3>
                <p className="text-xs text-muted-foreground">Choose the color used across buttons, sent bubbles, highlights, and icons.</p>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {colorOptions.map((option) => {
                  const selected = option.id === themeColor;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setThemeColor(option.id)}
                      className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-center transition-all hover:-translate-y-0.5 ${
                        selected ? "border-primary bg-accent shadow-sm" : "border-border bg-card"
                      }`}
                      aria-label={`Use ${option.label.toLowerCase()} theme`}
                      title={option.label}
                    >
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-full ring-2 ring-white/80"
                        style={{ backgroundColor: option.swatch }}
                      >
                        {selected && <Check className="h-4 w-4 text-white" />}
                      </span>
                      <span className="text-[11px] font-medium">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Appearance</h3>
                <p className="text-xs text-muted-foreground">Switch between light and dark mode. Your choice is saved automatically.</p>
              </div>
              <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{theme === "dark" ? "Dark Mode" : "Light Mode"}</p>
                  <p className="text-xs text-muted-foreground">Tap to switch instantly.</p>
                </div>
                <ThemeToggle />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={theme === "light" ? "default" : "outline"}
                  onClick={() => setTheme("light")}
                  className="rounded-xl"
                >
                  Light
                </Button>
                <Button
                  type="button"
                  variant={theme === "dark" ? "default" : "outline"}
                  onClick={() => setTheme("dark")}
                  className="rounded-xl"
                >
                  Dark
                </Button>
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Encryption Identity</h3>
                <p className="text-xs text-muted-foreground">This device fingerprint represents your current public encryption identity.</p>
              </div>
              <div className="rounded-2xl border bg-card px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      Identity fingerprint
                    </div>
                    <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                      {identityFingerprint || "Generating encryption identity..."}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void refreshIdentityFingerprint()}>
                    Refresh
                  </Button>
                </div>
              </div>
            </section>
          </div>
        )}

        {currentConversation && (
          <SafetyNumberDialog
            open={safetyDialogOpen}
            onOpenChange={setSafetyDialogOpen}
            otherUserName={currentConversation.otherUser.display_name}
            yourFingerprint={identityFingerprint}
            theirFingerprint={otherUserFingerprint}
          />
        )}
        <BlockedUsersDialog
          open={showBlockedUsers}
          onOpenChange={setShowBlockedUsers}
          existingConversationMap={existingConversationMap ?? new Map()}
          onOpenConversation={onOpenConversation}
        />
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
