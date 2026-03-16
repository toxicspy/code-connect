import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bot, Loader2 } from "lucide-react";
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
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful AI assistant. Be concise and friendly.");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("ai_chat_profiles")
        .insert({
          user_id: user.id,
          name: name.trim(),
          system_prompt: systemPrompt.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success(`${name} created!`);
      onCreated(data);
      onOpenChange(false);
      setName("AI Assistant");
      setSystemPrompt("You are a helpful AI assistant. Be concise and friendly.");
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
          <div className="space-y-2">
            <Label htmlFor="ai-name">AI Name</Label>
            <Input
              id="ai-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Study Buddy, Chef AI..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-prompt">Personality / Instructions</Label>
            <Textarea
              id="ai-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Describe how the AI should behave..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This defines the AI's personality and behavior.
            </p>
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
