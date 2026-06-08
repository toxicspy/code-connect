export const TREASURE_MESSAGE_TYPE = "treasure" as const;
export const TEXT_MESSAGE_TYPE = "text" as const;

export type SupportedMessageType = typeof TEXT_MESSAGE_TYPE | typeof TREASURE_MESSAGE_TYPE;

export const TREASURE_BOX_PREVIEW = "Treasure Box";

export const TREASURE_TEXT_STYLES = [
  { id: "normal", label: "Normal", category: "Basic", className: "treasure-style-normal", theme: "classic" },
  { id: "bold", label: "Bold", category: "Basic", className: "treasure-style-bold", theme: "classic" },
  { id: "italic", label: "Italic", category: "Basic", className: "treasure-style-italic", theme: "classic" },
  { id: "underline", label: "Underline", category: "Basic", className: "treasure-style-underline", theme: "classic" },
  { id: "cursive", label: "Cursive", category: "Fancy", className: "treasure-style-cursive", theme: "romance" },
  { id: "handwritten", label: "Handwritten", category: "Fancy", className: "treasure-style-handwritten", theme: "paper" },
  { id: "neon", label: "Neon", category: "Fancy", className: "treasure-style-neon", theme: "midnight" },
  { id: "typewriter", label: "Typewriter", category: "Fancy", className: "treasure-style-typewriter", theme: "paper" },
  { id: "love", label: "Love", category: "Themes", className: "treasure-style-love", theme: "love" },
  { id: "fire", label: "Fire", category: "Themes", className: "treasure-style-fire", theme: "fire" },
  { id: "gradient", label: "Gradient", category: "Themes", className: "treasure-style-gradient", theme: "aurora" },
  { id: "sparkle", label: "Sparkle", category: "Themes", className: "treasure-style-sparkle", theme: "sparkle" },
] as const;

export type TreasureTextStyle = (typeof TREASURE_TEXT_STYLES)[number]["id"];
export type TreasureTheme = (typeof TREASURE_TEXT_STYLES)[number]["theme"];

export interface TreasureStyleDefinition {
  id: TreasureTextStyle;
  label: string;
  category: string;
  className: string;
  theme: TreasureTheme;
}

export const DEFAULT_TREASURE_STYLE: TreasureTextStyle = "normal";

export const getTreasureStyleDefinition = (style?: string | null): TreasureStyleDefinition =>
  TREASURE_TEXT_STYLES.find((entry) => entry.id === style) ?? TREASURE_TEXT_STYLES[0];

export const getMessagePreview = (message?: {
  content?: string | null;
  is_encrypted?: boolean | null;
  file_name?: string | null;
  message_type?: string | null;
  media_type?: string | null;
  media_url?: string | null;
  is_opened?: boolean | null;
}) => {
  if (!message) return "No messages yet";
  if (message.is_encrypted) {
    return "Encrypted message";
  }
  if (message.message_type === TREASURE_MESSAGE_TYPE) {
    return message.is_opened ? "Treasure Box opened" : "Treasure Box";
  }
  if (message.media_url) {
    if (message.media_type?.startsWith("image/")) {
      return "Photo";
    }
    if (message.media_type?.startsWith("video/")) {
      return "Video";
    }

    return message.file_name ? `Attachment: ${message.file_name}` : "Attachment";
  }

  return message.content || "No messages yet";
};

export const getMessageTypeLabel = (message?: {
  message_type?: string | null;
  media_type?: string | null;
  media_url?: string | null;
  file_name?: string | null;
}) => {
  if (!message) return "message";
  if (message.message_type === TREASURE_MESSAGE_TYPE) return "treasure";
  if (message.media_url) {
    if (message.media_type?.startsWith("image/")) return "photo";
    if (message.media_type?.startsWith("video/")) return "video";
    if (message.media_type?.startsWith("audio/")) return "voice note";
    return "file";
  }
  return "message";
};
