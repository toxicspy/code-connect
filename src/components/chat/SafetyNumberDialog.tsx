import { ShieldCheck, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SafetyNumberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otherUserName: string;
  yourFingerprint: string | null;
  theirFingerprint: string | null;
}

const SafetyNumberDialog = ({
  open,
  onOpenChange,
  otherUserName,
  yourFingerprint,
  theirFingerprint,
}: SafetyNumberDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            Verify Safety Numbers
          </DialogTitle>
          <DialogDescription>
            Compare these fingerprints with {otherUserName} on a trusted channel. If they match, you are talking to the right person.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl border bg-card px-4 py-3">
            <div className="text-sm font-semibold">Your fingerprint</div>
            <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
              {yourFingerprint || "Generating your identity..."}
            </p>
          </div>

          <div className="rounded-2xl border bg-card px-4 py-3">
            <div className="text-sm font-semibold">{otherUserName}'s fingerprint</div>
            <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
              {theirFingerprint || "Waiting for their identity key..."}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2 font-medium">
              <ShieldAlert className="h-4 w-4" />
              Verification tip
            </div>
            <p className="mt-1 text-xs leading-5">
              If the other user’s fingerprint changes unexpectedly, treat it as suspicious until you confirm it with them.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SafetyNumberDialog;
