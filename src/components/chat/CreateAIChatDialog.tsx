import { useState, useRef } from "react";
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

interface CreateAIChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (profile: { id: string; name: string; avatar_url: string | null; system_prompt: string | null }) => void;
}

const CreateAIChatDialog = ({ open, onOpenChange, onCreated }: CreateAIChatDialogProps) => {
  const { user } = useAuth();
  const [name, setName] = useState("AI Assistant");
  const [systemPrompt, setSystemPrompt] = useState("You are a warm, friendly AI companion. Chat naturally like a close friend — use casual language, show genuine interest, ask follow-up questions, use emojis occasionally, and keep responses conversational. Be empathetic, supportive, and fun to talk to.");
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    try {
      let avatarUrl: string | null = null;

      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${user.id}/ai-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, avatarFile);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        avatarUrl = urlData.publicUrl;
      }

      const { data, error } = await supabase
        .from("ai_chat_profiles")
        .insert({
          user_id: user.id,
          name: name.trim(),
          system_prompt: systemPrompt.trim() || null,
          avatar_url: avatarUrl,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success(`${name} created!`);
      onCreated(data);
      onOpenChange(false);
      setName("AI Assistant");
      setSystemPrompt("You are a helpful AI assistant. Be concise and friendly.");
      setAvatarFile(null);
      setAvatarPreview(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to create AI chat");
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
            Create AI Chat
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Avatar upload */}
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
            <Label htmlFor="ai-name">AI Name</Label>
            <Input id="ai-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Study Buddy, Chef AI..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-prompt">Personality / Instructions</Label>
            <Textarea id="ai-prompt" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="Describe how the AI should behave..." rows={3} />
            <p className="text-xs text-muted-foreground">This defines the AI's personality and behavior.</p>
          </div>
          <Button onClick={handleCreate} disabled={!name.trim() || saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bot className="h-4 w-4 mr-2" />}
            Create AI Chat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateAIChatDialog;
