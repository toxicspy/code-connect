import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserPlus, Hash } from "lucide-react";
import { toast } from "sonner";

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AddContactDialog = ({ open, onOpenChange }: AddContactDialogProps) => {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!user || !code.trim()) return;
    setLoading(true);

    try {
      // Find user by code
      const { data: targetProfile, error: findError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_code", code.trim().toUpperCase())
        .single();

      if (findError || !targetProfile) {
        toast.error("No user found with that code");
        return;
      }

      if (targetProfile.user_id === user.id) {
        toast.error("You can't add yourself!");
        return;
      }

      // Check if already a contact
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("user_id", user.id)
        .eq("contact_user_id", targetProfile.user_id)
        .single();

      if (existing) {
        toast.info("This user is already in your contacts");
        return;
      }

      // Add contact
      await supabase.from("contacts").insert({
        user_id: user.id,
        contact_user_id: targetProfile.user_id,
      });

      // Check for existing conversation
      const { data: myConvs } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      const { data: theirConvs } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", targetProfile.user_id);

      const myIds = new Set(myConvs?.map((c) => c.conversation_id));
      const sharedConv = theirConvs?.find((c) => myIds.has(c.conversation_id));

      if (!sharedConv) {
        // Create conversation with known id (avoids requiring immediate SELECT on new row)
        const convId = crypto.randomUUID();

        const { error: convError } = await supabase
          .from("conversations")
          .insert({ id: convId });
        if (convError) throw convError;

        const { error: selfParticipantError } = await supabase
          .from("conversation_participants")
          .insert({ conversation_id: convId, user_id: user.id });
        if (selfParticipantError) throw selfParticipantError;

        const { error: otherParticipantError } = await supabase
          .from("conversation_participants")
          .insert({ conversation_id: convId, user_id: targetProfile.user_id });
        if (otherParticipantError) throw otherParticipantError;
      }

      toast.success(`Added ${targetProfile.display_name} to contacts!`);
      setCode("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add contact");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Add Contact</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Enter the unique code of the person you want to chat with.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter user code"
              className="pl-9 font-mono uppercase"
              maxLength={8}
            />
          </div>
          <Button onClick={handleAdd} disabled={loading || !code.trim()} className="gap-2">
            <UserPlus className="h-4 w-4" />
            {loading ? "Adding..." : "Add"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddContactDialog;
