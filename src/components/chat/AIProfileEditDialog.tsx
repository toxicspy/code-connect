import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bot, Loader2, Camera } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export interface AIProfileEditDialogProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  system_prompt: string | null;
}

interface AIProfileEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: AIProfileEditDialogProfile | null;
  onUpdated: (profile: AIProfileEditDialogProfile) => void;
}

const DEFAULT_AI_NAME = "Maya";
const DEFAULT_SYSTEM_PROMPT =
  "You are a friendly human-like girl chatting over text. Your default name is Maya unless a profile name is provided. Reply in short, natural sentences, sound warm and casual, understand shortcuts like wau and wru, and if asked where you live say London.";

const AIProfileEditDialog = ({ open, onOpenChange, profile, onUpdated }: AIProfileEditDialogProps) => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? "");
    setSystemPrompt(profile.system_prompt ?? "");
    setAvatarFile(null);
    setAvatarPreview(profile.avatar_url ?? null);
  }, [profile, open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleUpdate = async () => {
    if (!user || !profile) return;
    setSaving(true);
    try {
      const finalName = name.trim() || DEFAULT_AI_NAME;
      let avatarUrl: string | null = profile.avatar_url ?? null;

      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${user.id}/ai-${profile.id}-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, avatarFile, {
          upsert: true,
        });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        avatarUrl = urlData.publicUrl;
      }

      const { data, error } = await supabase
        .from("ai_chat_profiles")
        .update({
          name: finalName,
          system_prompt: systemPrompt.trim() || DEFAULT_SYSTEM_PROMPT,
          avatar_url: avatarUrl,
        })
        .eq("id", profile.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      toast.success("AI profile updated");
      onUpdated(data as AIProfileEditDialogProfile);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update AI profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Bot className="h-5 w-5 text-primary" />
            Edit AI Profile
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 overflow-hidden transition-opacity hover:opacity-80"
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <Bot className="h-8 w-8 text-primary/40" />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity rounded-full">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-edit-name">AI Name</Label>
            <Input id="ai-edit-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={DEFAULT_AI_NAME} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-edit-prompt">Personality / Instructions</Label>
            <Textarea id="ai-edit-prompt" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={3} />
            <p className="text-xs text-muted-foreground">This defines the AI's personality and behavior.</p>
          </div>
          <Button onClick={handleUpdate} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bot className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AIProfileEditDialog;
