import { Settings2, Check } from "lucide-react";
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

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const colorOptions: Array<{ id: ThemeColor; label: string; swatch: string }> = [
  { id: "green", label: "Green", swatch: "hsl(160 84% 39%)" },
  { id: "blue", label: "Blue", swatch: "hsl(212 95% 52%)" },
  { id: "purple", label: "Purple", swatch: "hsl(270 76% 56%)" },
  { id: "red", label: "Red", swatch: "hsl(355 84% 58%)" },
  { id: "orange", label: "Orange", swatch: "hsl(28 96% 52%)" },
];

const SettingsDialog = ({ open, onOpenChange }: SettingsDialogProps) => {
  const { theme, setTheme, themeColor, setThemeColor } = useTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-auto bottom-0 max-w-none translate-x-[-50%] translate-y-0 rounded-t-3xl rounded-b-none border-b-0 px-5 pb-6 pt-5 sm:top-[50%] sm:max-w-md sm:translate-y-[-50%] sm:rounded-2xl sm:border-b">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2 font-display text-left">
            <Settings2 className="h-5 w-5 text-primary" />
            Settings
          </DialogTitle>
          <DialogDescription className="text-left">
            Customize how yoobro looks and feels.
          </DialogDescription>
        </DialogHeader>

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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
