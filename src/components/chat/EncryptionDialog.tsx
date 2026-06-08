import { useEffect, useState } from "react";
import { Lock, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EncryptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPassphrase: string;
  encrypted: boolean;
  onSave: (passphrase: string) => void;
  onDisable: () => void;
}

const EncryptionDialog = ({
  open,
  onOpenChange,
  defaultPassphrase,
  encrypted,
  onSave,
  onDisable,
}: EncryptionDialogProps) => {
  const [passphrase, setPassphrase] = useState(defaultPassphrase);

  useEffect(() => {
    setPassphrase(defaultPassphrase);
  }, [defaultPassphrase, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Lock className="h-5 w-5 text-primary" />
            End-to-End Encryption
          </DialogTitle>
          <DialogDescription>
            Encryption is optional for each chat. It only turns on after you enable the lock here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className={`rounded-2xl border px-4 py-3 ${encrypted ? "border-emerald-500/30 bg-emerald-500/10" : "border-border bg-card"}`}>
            <div className="flex items-center gap-2 text-sm font-medium">
              {encrypted ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <ShieldOff className="h-4 w-4 text-muted-foreground" />}
              {encrypted ? "Encryption enabled on this device" : "Encryption is currently off"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              When off, this chat works like normal. When on, new text messages are encrypted before upload.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Shared passphrase</label>
            <Input
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="Enter a shared secret"
              className="rounded-2xl"
            />
            <p className="text-xs text-muted-foreground">
              Keep this secret off the server. If you forget it, old encrypted messages cannot be recovered.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {encrypted ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                onDisable();
                onOpenChange(false);
              }}
            >
              Disable
            </Button>
          ) : (
            <div />
          )}
          <Button
            type="button"
            className="rounded-full"
            disabled={!passphrase.trim()}
            onClick={() => {
              onSave(passphrase.trim());
              onOpenChange(false);
            }}
          >
            Save Passphrase
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EncryptionDialog;
