import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark";
export type ThemeColor = "green" | "blue" | "purple" | "red" | "orange";

interface ThemePalette {
  primary: string;
  accent: string;
  accentForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  userCodeBg: string;
  userCodeFg: string;
  chatBubbleSent: string;
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
}

const THEME_STORAGE_KEY = "yoobro-theme";
const THEME_COLOR_STORAGE_KEY = "yoobro-theme-color";

const colorPalettes: Record<ThemeColor, { light: ThemePalette; dark: ThemePalette }> = {
  green: {
    light: {
      primary: "160 84% 39%",
      accent: "160 60% 92%",
      accentForeground: "160 84% 25%",
      sidebarAccent: "160 60% 95%",
      sidebarAccentForeground: "160 84% 25%",
      userCodeBg: "160 60% 95%",
      userCodeFg: "160 84% 30%",
      chatBubbleSent: "160 84% 39%",
    },
    dark: {
      primary: "160 84% 39%",
      accent: "160 60% 15%",
      accentForeground: "160 60% 80%",
      sidebarAccent: "160 60% 12%",
      sidebarAccentForeground: "160 60% 80%",
      userCodeBg: "160 60% 12%",
      userCodeFg: "160 60% 75%",
      chatBubbleSent: "160 84% 30%",
    },
  },
  blue: {
    light: {
      primary: "212 95% 52%",
      accent: "210 100% 94%",
      accentForeground: "216 84% 30%",
      sidebarAccent: "210 100% 95%",
      sidebarAccentForeground: "216 84% 30%",
      userCodeBg: "210 100% 95%",
      userCodeFg: "216 84% 36%",
      chatBubbleSent: "212 95% 52%",
    },
    dark: {
      primary: "212 95% 60%",
      accent: "217 70% 16%",
      accentForeground: "210 100% 85%",
      sidebarAccent: "217 70% 14%",
      sidebarAccentForeground: "210 100% 85%",
      userCodeBg: "217 70% 14%",
      userCodeFg: "210 100% 82%",
      chatBubbleSent: "212 95% 48%",
    },
  },
  purple: {
    light: {
      primary: "270 76% 56%",
      accent: "270 100% 95%",
      accentForeground: "270 72% 32%",
      sidebarAccent: "270 100% 96%",
      sidebarAccentForeground: "270 72% 32%",
      userCodeBg: "270 100% 95%",
      userCodeFg: "270 72% 36%",
      chatBubbleSent: "270 76% 56%",
    },
    dark: {
      primary: "270 76% 64%",
      accent: "270 38% 17%",
      accentForeground: "275 100% 88%",
      sidebarAccent: "270 38% 15%",
      sidebarAccentForeground: "275 100% 88%",
      userCodeBg: "270 38% 15%",
      userCodeFg: "275 100% 86%",
      chatBubbleSent: "270 76% 54%",
    },
  },
  red: {
    light: {
      primary: "355 84% 58%",
      accent: "355 100% 95%",
      accentForeground: "355 72% 36%",
      sidebarAccent: "355 100% 96%",
      sidebarAccentForeground: "355 72% 36%",
      userCodeBg: "355 100% 95%",
      userCodeFg: "355 72% 40%",
      chatBubbleSent: "355 84% 58%",
    },
    dark: {
      primary: "355 84% 64%",
      accent: "355 36% 17%",
      accentForeground: "355 100% 89%",
      sidebarAccent: "355 36% 15%",
      sidebarAccentForeground: "355 100% 89%",
      userCodeBg: "355 36% 15%",
      userCodeFg: "355 100% 86%",
      chatBubbleSent: "355 84% 52%",
    },
  },
  orange: {
    light: {
      primary: "28 96% 52%",
      accent: "35 100% 93%",
      accentForeground: "24 90% 32%",
      sidebarAccent: "35 100% 95%",
      sidebarAccentForeground: "24 90% 32%",
      userCodeBg: "35 100% 94%",
      userCodeFg: "24 90% 36%",
      chatBubbleSent: "28 96% 52%",
    },
    dark: {
      primary: "28 96% 60%",
      accent: "28 38% 17%",
      accentForeground: "35 100% 87%",
      sidebarAccent: "28 38% 15%",
      sidebarAccentForeground: "35 100% 87%",
      userCodeBg: "28 38% 15%",
      userCodeFg: "35 100% 84%",
      chatBubbleSent: "28 96% 50%",
    },
  },
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "light";

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const getInitialThemeColor = (): ThemeColor => {
  if (typeof window === "undefined") return "green";

  const savedColor = window.localStorage.getItem(THEME_COLOR_STORAGE_KEY);
  if (savedColor && savedColor in colorPalettes) {
    return savedColor as ThemeColor;
  }

  return "green";
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [themeColor, setThemeColor] = useState<ThemeColor>(getInitialThemeColor);

  useEffect(() => {
    const root = window.document.documentElement;
    const palette = colorPalettes[themeColor][theme];

    root.classList.toggle("dark", theme === "dark");
    root.style.setProperty("--primary", palette.primary);
    root.style.setProperty("--ring", palette.primary);
    root.style.setProperty("--accent", palette.accent);
    root.style.setProperty("--accent-foreground", palette.accentForeground);
    root.style.setProperty("--sidebar-primary", palette.primary);
    root.style.setProperty("--sidebar-ring", palette.primary);
    root.style.setProperty("--sidebar-accent", palette.sidebarAccent);
    root.style.setProperty("--sidebar-accent-foreground", palette.sidebarAccentForeground);
    root.style.setProperty("--user-code-bg", palette.userCodeBg);
    root.style.setProperty("--user-code-fg", palette.userCodeFg);
    root.style.setProperty("--chat-bubble-sent", palette.chatBubbleSent);

    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.localStorage.setItem(THEME_COLOR_STORAGE_KEY, themeColor);
  }, [theme, themeColor]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark")),
      themeColor,
      setThemeColor,
    }),
    [theme, themeColor]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};
