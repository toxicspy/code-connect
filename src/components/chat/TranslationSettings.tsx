import { Languages } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const LANGUAGES = [
  "Kannada", "Hindi", "Tamil", "Telugu", "Malayalam",
  "Bengali", "Marathi", "Gujarati", "Punjabi", "Urdu",
  "Spanish", "French", "German", "Japanese", "Korean",
  "Chinese", "Arabic", "Portuguese", "Russian", "Italian",
];

interface TranslationSettingsProps {
  enabled: boolean;
  targetLanguage: string;
  onToggle: (val: boolean) => void;
  onLanguageChange: (lang: string) => void;
}

const TranslationSettings = ({
  enabled,
  targetLanguage,
  onToggle,
  onLanguageChange,
}: TranslationSettingsProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 ${enabled ? "text-primary" : ""}`}
        >
          <Languages className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="translate-toggle" className="text-sm font-semibold">
              Translate Messages
            </Label>
            <Switch
              id="translate-toggle"
              checked={enabled}
              onCheckedChange={onToggle}
            />
          </div>

          {enabled && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Translate to
              </Label>
              <Select value={targetLanguage} onValueChange={onLanguageChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TranslationSettings;
