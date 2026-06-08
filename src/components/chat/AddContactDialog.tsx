import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useChatRequests } from "@/hooks/useChatRequests";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserPlus, Search } from "lucide-react";
import { toast } from "sonner";
import { sanitizeDisplayName } from "@/lib/profile-utils";
import type { Tables } from "@/integrations/supabase/types";

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestSent?: () => Promise<void> | void;
}

type Profile = Tables<"profiles">;

const AddContactDialog = ({ open, onOpenChange, onRequestSent }: AddContactDialogProps) => {
  const { user } = useAuth();
  const { getRequestStateForUser, sendRequest } = useChatRequests();
  const [search, setSearch] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !search.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const normalizedSearch = search.trim().replace(/^#/, "");
    const searchTerm = `%${normalizedSearch.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    let isCancelled = false;

    const timer = setTimeout(async () => {
      if (!normalizedSearch) {
        setSearchResults([]);
        setSearching(false);
        return;
      }

      setSearching(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, user_code, username, avatar_url")
        .neq("user_id", user.id)
        .or(`user_code.ilike.${searchTerm},display_name.ilike.${searchTerm},username.ilike.${searchTerm}`)
        .order("display_name", { ascending: true })
        .limit(8);

      if (isCancelled) return;
      setSearching(false);

      if (error) {
        console.error("Search failed", error);
        setSearchResults([]);
        return;
      }

      setSearchResults((data as Profile[]) || []);
    }, 180);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [search, user]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    const normalizedValue = value.trim().replace(/^#/, "").toLowerCase();

    if (
      selectedProfile &&
      normalizedValue !== selectedProfile.user_code.toLowerCase() &&
      normalizedValue !== selectedProfile.display_name.toLowerCase() &&
      normalizedValue !== (selectedProfile.username ?? "").toLowerCase()
    ) {
      setSelectedProfile(null);
    }
  };

  const handleSend = async () => {
    if (!user || !search.trim()) return;
    setLoading(true);

    try {
      let targetProfile = selectedProfile;
      const normalizedSearch = search.trim().replace(/^#/, "");
      const upperSearch = normalizedSearch.toUpperCase();
      const isUserCode = /^[A-Z0-9]{4,}$/.test(upperSearch);

      if (!targetProfile) {
        if (isUserCode) {
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_code", upperSearch)
            .single();

          if (error || !data) {
            toast.error("No user found with that code");
            return;
          }

          targetProfile = data as Profile;
        } else if (searchResults.length === 1) {
          targetProfile = searchResults[0];
        }
      }

      if (!targetProfile) {
        toast.error("Select a user from the list or enter a valid user code.");
        return;
      }

      if (targetProfile.user_id === user.id) {
        toast.error("You can't add yourself!");
        return;
      }

      const requestState = getRequestStateForUser(targetProfile.user_id);
      if (requestState === "pending_sent") {
        toast.error("You already sent a request to this user.");
        return;
      }
      if (requestState === "accepted") {
        toast.error("You already have an active chat with this user.");
        return;
      }
      if (requestState === "pending_received") {
        toast.error("This user already sent you a request.");
        return;
      }
      if (requestState === "blocked") {
        toast.error("You cannot send a request to this user.");
        return;
      }

      const { error } = await sendRequest(targetProfile.user_id);
      if (error) {
        throw error;
      }

      toast.success(`Chat request sent to ${sanitizeDisplayName(targetProfile.display_name)}.`);
      setSearch("");
      setSelectedProfile(null);
      setSearchResults([]);
      onOpenChange(false);
      await onRequestSent?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to send request");
    } finally {
      setLoading(false);
    }
  };

  const selectedLabel = selectedProfile ? `${sanitizeDisplayName(selectedProfile.display_name)} · #${selectedProfile.user_code}` : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Send Chat Request</DialogTitle>
        </DialogHeader>
        <p className="mb-4 text-sm text-muted-foreground">
          Enter a user code or search by display name / username. Click a suggestion to target the right person instantly.
        </p>
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name, username, or user code"
              className="h-12 rounded-2xl border-white/70 bg-white/10 pl-10 text-sm text-foreground shadow-none focus:ring-2 focus:ring-primary/40"
              autoComplete="off"
            />
          </div>

          {selectedLabel && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary-foreground">
              Selected user: <span className="font-semibold text-foreground">{selectedLabel}</span>
            </div>
          )}

          {search.trim() !== "" && (
            <div className="max-h-72 overflow-hidden rounded-3xl border border-white/10 bg-background/90 shadow-xl shadow-black/10">
              {searching ? (
                <div className="flex items-center justify-center gap-2 px-4 py-5 text-sm text-muted-foreground">
                  <span>Searching users...</span>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((profile) => {
                  const isSelected = selectedProfile?.user_id === profile.user_id;
                  return (
                    <button
                      key={profile.user_id}
                      type="button"
                      onClick={() => {
                        setSelectedProfile(profile);
                        setSearch(sanitizeDisplayName(profile.display_name));
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${isSelected ? "bg-primary/10" : "hover:bg-white/5"}`}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          sanitizeDisplayName(profile.display_name).charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{sanitizeDisplayName(profile.display_name)}</p>
                        <p className="truncate text-xs text-muted-foreground">{profile.username ? `@${profile.username}` : `#${profile.user_code}`}</p>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-5 text-sm text-muted-foreground">No users found</div>
              )}
            </div>
          )}

          <Button onClick={handleSend} disabled={loading || !search.trim()} className="w-full gap-2 rounded-2xl text-sm font-semibold">
            <UserPlus className="h-4 w-4" />
            {loading ? "Sending..." : "Send Chat Request"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddContactDialog;
