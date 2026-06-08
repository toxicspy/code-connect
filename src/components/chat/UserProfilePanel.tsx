import { useEffect, useMemo, useState } from "react";
import {
  BellOff,
  Ban,
  ExternalLink,
  FileText,
  Flag,
  ImageIcon,
  Link2,
  PlayCircle,
} from "lucide-react";
import type { ConversationWithDetails } from "@/hooks/useConversations";
import type { ChatMessage } from "@/hooks/useMessages";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { sanitizeDisplayName } from "@/lib/profile-utils";

interface UserProfilePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: ConversationWithDetails;
  messages: ChatMessage[];
}

type ProfileTab = "media" | "links" | "documents";

interface MediaItem {
  id: string;
  url: string;
  kind: "image" | "video";
  label: string;
  timestamp: string;
}

interface LinkItem {
  id: string;
  url: string;
  timestamp: string;
}

interface DocumentItem {
  id: string;
  url: string;
  fileName: string;
  mediaType: string | null;
  timestamp: string;
}

const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;

const formatUrl = (value: string) => (value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`);

const tabButtonClasses = (active: boolean) =>
  `rounded-full px-4 py-2 text-sm font-medium transition-all ${
    active
      ? "bg-primary text-primary-foreground shadow-sm"
      : "bg-muted/70 text-muted-foreground hover:bg-accent hover:text-foreground"
  }`;

const UserProfilePanel = ({ open, onOpenChange, conversation, messages }: UserProfilePanelProps) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<ProfileTab>("media");
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);

  useEffect(() => {
    if (!user?.id || !conversation?.otherUser.user_id) {
      setBlocked(false);
      return;
    }

    let cancelled = false;

    const fetchBlockState = async () => {
      const { data } = await supabase
        .from("blocks")
        .select("id")
        .eq("blocker_id", user.id)
        .eq("blocked_user_id", conversation.otherUser.user_id)
        .maybeSingle();

      if (!cancelled) {
        setBlocked(Boolean(data));
      }
    };

    void fetchBlockState();

    return () => {
      cancelled = true;
    };
  }, [conversation?.otherUser.user_id, user?.id]);

  const derivedData = useMemo(() => {
    const media: MediaItem[] = [];
    const links: LinkItem[] = [];
    const documents: DocumentItem[] = [];

    messages.forEach((message) => {
      if (message.media_url && message.media_type?.startsWith("image/")) {
        media.push({
          id: message.id,
          url: message.media_url,
          kind: "image",
          label: message.file_name || "Shared image",
          timestamp: message.created_at,
        });
      } else if (message.media_url && message.media_type?.startsWith("video/")) {
        media.push({
          id: message.id,
          url: message.media_url,
          kind: "video",
          label: message.file_name || "Shared video",
          timestamp: message.created_at,
        });
      } else if (message.media_url) {
        documents.push({
          id: message.id,
          url: message.media_url,
          fileName: message.file_name || "Shared document",
          mediaType: message.media_type,
          timestamp: message.created_at,
        });
      }

      const matches = message.content.match(linkRegex);
      if (matches) {
        matches.forEach((link, index) => {
          links.push({
            id: `${message.id}-${index}`,
            url: formatUrl(link),
            timestamp: message.created_at,
          });
        });
      }
    });

    return { media, links, documents };
  }, [messages]);

  const handleBlockToggle = async () => {
    if (!user?.id) return;

    setBlockBusy(true);
    try {
      if (blocked) {
        const [blockDelete, blockedUserDelete, blockedDeviceDelete] = await Promise.all([
          supabase
            .from("blocks")
            .delete()
            .eq("blocker_id", user.id)
            .eq("blocked_user_id", conversation.otherUser.user_id),
          supabase
            .from("blocked_users")
            .delete()
            .eq("blocker_user_id", user.id)
            .eq("blocked_user_id", conversation.otherUser.user_id),
          supabase
            .from("blocked_devices")
            .delete()
            .eq("blocker_user_id", user.id)
            .eq("blocked_user_id", conversation.otherUser.user_id),
        ]);

        if (blockDelete.error) throw blockDelete.error;
        if (blockedUserDelete.error) throw blockedUserDelete.error;
        if (blockedDeviceDelete.error) throw blockedDeviceDelete.error;
        setBlocked(false);
        toast.success("User unblocked");
      } else {
        const { error } = await supabase.rpc("block_chat_user", {
          _blocked_user_id: conversation.otherUser.user_id,
        });

        if (error) throw error;
        setBlocked(true);
        toast.success("User blocked");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update block status");
    } finally {
      setBlockBusy(false);
    }
  };

  const actionButtons = [
    {
      label: muted ? "Muted" : "Mute user",
      icon: BellOff,
      className: muted
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : "border-border bg-card hover:bg-accent",
      onClick: () => {
        setMuted((prev) => !prev);
        toast.success(muted ? "User unmuted" : "User muted");
      },
    },
    {
      label: blocked ? "Blocked" : "Block user",
      icon: Ban,
      className: blocked
        ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
        : "border-border bg-card hover:bg-accent",
      onClick: handleBlockToggle,
      disabled: blockBusy,
    },
    {
      label: "Report user",
      icon: Flag,
      className: "border-border bg-card hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300",
      onClick: () => toast.success("User reported"),
    },
  ];

  const content = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <SheetHeader className="space-y-2 border-b border-border/70 px-6 pb-5 text-left">
        <SheetTitle className="font-display text-xl">Contact Info</SheetTitle>
        <SheetDescription>Profile details, shared media, links, and documents.</SheetDescription>
      </SheetHeader>

      <div className="app-scroll-area flex-1 space-y-6 overflow-y-auto px-6 py-6">
        <section className="rounded-[1.75rem] border border-white/60 bg-card/90 p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-card/80">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-primary/10 text-2xl font-semibold text-primary dark:border-white/10">
              {conversation.otherUser.avatar_url ? (
                <img src={conversation.otherUser.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>{sanitizeDisplayName(conversation.otherUser.display_name).charAt(0).toUpperCase()}</span>
              )}
            </div>
            <h3 className="mt-4 font-display text-xl font-semibold">{sanitizeDisplayName(conversation.otherUser.display_name)}</h3>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              {conversation.otherUser.status?.trim() || "No bio available"}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {actionButtons.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-all hover:-translate-y-0.5 ${action.className}`}
                >
                  <Icon className="h-4 w-4" />
                  {action.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={tabButtonClasses(activeTab === "media")} onClick={() => setActiveTab("media")}>
              Media ({derivedData.media.length})
            </button>
            <button type="button" className={tabButtonClasses(activeTab === "links")} onClick={() => setActiveTab("links")}>
              Links ({derivedData.links.length})
            </button>
            <button type="button" className={tabButtonClasses(activeTab === "documents")} onClick={() => setActiveTab("documents")}>
              Documents ({derivedData.documents.length})
            </button>
          </div>

          {activeTab === "media" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {derivedData.media.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-dashed border-border bg-card/70 px-4 py-10 text-center text-sm text-muted-foreground">
                  No images or videos shared yet.
                </div>
              ) : (
                derivedData.media.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPreviewItem(item)}
                    className="group relative overflow-hidden rounded-[1.4rem] border border-border bg-card text-left shadow-sm transition-transform hover:-translate-y-0.5"
                  >
                    {item.kind === "image" ? (
                      <img src={item.url} alt={item.label} loading="lazy" className="h-32 w-full object-cover" />
                    ) : (
                      <div className="flex h-32 w-full items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 text-white">
                        <PlayCircle className="h-10 w-10 opacity-90" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8 text-white">
                      <p className="truncate text-xs font-medium">{item.label}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {activeTab === "links" && (
            <div className="space-y-3">
              {derivedData.links.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card/70 px-4 py-10 text-center text-sm text-muted-foreground">
                  No links shared yet.
                </div>
              ) : (
                derivedData.links.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-4 transition-colors hover:bg-accent/40"
                  >
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Link2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.url}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Open in new tab</p>
                    </div>
                    <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  </a>
                ))
              )}
            </div>
          )}

          {activeTab === "documents" && (
            <div className="space-y-3">
              {derivedData.documents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card/70 px-4 py-10 text-center text-sm text-muted-foreground">
                  No documents shared yet.
                </div>
              ) : (
                derivedData.documents.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-4 transition-colors hover:bg-accent/40"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.fileName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.mediaType || "Document"} file</p>
                    </div>
                  </a>
                ))
              )}
            </div>
          )}
        </section>
      </div>

      <Dialog open={Boolean(previewItem)} onOpenChange={(next) => !next && setPreviewItem(null)}>
        <DialogContent className="max-w-3xl border-0 bg-transparent p-0 shadow-none">
          {previewItem && (
            <div className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-slate-950 p-2 shadow-2xl">
              {previewItem.kind === "image" ? (
                <img src={previewItem.url} alt={previewItem.label} className="max-h-[75vh] w-full rounded-[1.2rem] object-contain" />
              ) : (
                <video controls autoPlay className="max-h-[75vh] w-full rounded-[1.2rem] bg-black" src={previewItem.url} />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="h-[92vh] rounded-t-[2rem] border-border/70 bg-background/95 p-0 backdrop-blur-xl sm:h-full sm:max-w-xl sm:rounded-none"
      >
        {content}
      </SheetContent>
    </Sheet>
  );
};

export default UserProfilePanel;
