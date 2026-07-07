import { type LucideIcon } from "lucide-react";

export type Theme = "light" | "dark" | "system";

export interface NavigationItem {
  label: string;
  href: string;
  icon: "Home" | "FolderHeart" | "Folder" | "Film" | "Tv" | "Sparkles" | "Settings" | "Bookmark" | "Heart" | LucideIcon;
}

export interface LayoutConfig {
  sidebarWidth: number;
  mobileBreakpoint: number;
}

export interface AnimationConfig {
  defaultDuration: number;
  defaultEase: string;
}

export interface AppConfig {
  name: string;
  version: string;
  defaultTheme: Theme;
  defaultLanguage: string;
  layout: LayoutConfig;
  animation: AnimationConfig;
  features: {
    enableAuthentication: boolean;
    enableGoogleDrive: boolean;
    enableSupabase: boolean;
  };
}

export interface DesignTokens {
  glass: {
    opacity: number;
    blur: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    "2xl": string;
    "3xl": string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  animation: {
    duration: {
      fast: string;
      normal: string;
      slow: string;
    };
  };
  zIndex: {
    backdrop: number;
    sidebar: number;
    topbar: number;
  };
}
