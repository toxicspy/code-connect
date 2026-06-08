import { useMemo } from "react";
import { Gift, Heart, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getTreasureStyleDefinition } from "@/lib/message-utils";

interface TreasureBoxRevealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  opened: boolean;
  textStyle?: string | null;
  themeType?: string | null;
}

const TreasureBoxRevealDialog = ({
  open,
  onOpenChange,
  message,
  opened,
  textStyle,
  themeType,
}: TreasureBoxRevealDialogProps) => {
  const styleDefinition = getTreasureStyleDefinition(textStyle);
  const sparkles = useMemo(
    () =>
      Array.from({ length: 10 }, (_, index) => ({
        id: index,
        style: {
          left: `${12 + ((index * 9) % 76)}%`,
          top: `${8 + ((index * 13) % 68)}%`,
          animationDelay: `${index * 0.18}s`,
          animationDuration: `${2.6 + (index % 3) * 0.45}s`,
        },
      })),
    [],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="treasure-dialog border-0 bg-transparent p-0 shadow-none sm:max-w-lg">
        <div
          className={`treasure-dialog-card treasure-theme-${themeType || styleDefinition.theme} relative overflow-hidden rounded-[2rem] px-6 py-8 text-center shadow-[0_30px_120px_-45px_rgba(15,23,42,0.9)]`}
        >
          <div className="pointer-events-none absolute inset-0">
            {sparkles.map((sparkle) => (
              <span
                key={sparkle.id}
                className="treasure-popup-sparkle treasure-sparkle absolute inline-flex h-6 w-6 items-center justify-center"
                style={sparkle.style}
              >
                <Sparkles className="h-4 w-4" />
              </span>
            ))}
          </div>

          <DialogHeader className="relative z-10 items-center text-center">
            <div className="treasure-box-stage mb-6">
              <div className={`treasure-box ${open ? "is-open" : ""}`}>
                <div className="treasure-box-lid" />
                <div className="treasure-box-base">
                  <Gift className="h-8 w-8 text-amber-100" />
                </div>
                <div className="treasure-box-glow" />
              </div>
            </div>

            <DialogTitle className="treasure-popup-title font-display text-2xl font-semibold">
              {opened ? "Treasure Box Opened" : "A Secret Message For You"}
            </DialogTitle>
            <DialogDescription className="treasure-popup-description">
              Styled with {styleDefinition.label}.
            </DialogDescription>
          </DialogHeader>

          <div className="treasure-message-panel relative z-10 mt-6 rounded-[1.6rem] px-5 py-6 backdrop-blur-xl">
            <div className="treasure-popup-icon-row mb-3 flex items-center justify-center gap-2 text-2xl">
              <span>💌</span>
              {(styleDefinition.theme === "love" || styleDefinition.id === "love") && <Heart className="h-5 w-5" />}
            </div>
            <p className={`treasure-message-text ${styleDefinition.className} whitespace-pre-wrap break-words`}>
              {message}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TreasureBoxRevealDialog;
