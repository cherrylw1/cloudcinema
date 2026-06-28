import { type DesignTokens } from "@/types";

export const designTokens: DesignTokens = {
  glass: {
    opacity: 0.55,
    blur: "24px",
  },
  borderRadius: {
    sm: "calc(var(--radius) - 4px)",
    md: "calc(var(--radius) - 2px)",
    lg: "var(--radius)",
    xl: "calc(var(--radius) + 4px)",
    "2xl": "calc(var(--radius) + 8px)",
    "3xl": "calc(var(--radius) + 16px)",
  },
  spacing: {
    xs: "0.5rem",
    sm: "0.75rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
  },
  animation: {
    duration: {
      fast: "150ms",
      normal: "200ms",
      slow: "300ms",
    },
  },
  zIndex: {
    backdrop: 40,
    sidebar: 50,
    topbar: 30,
  },
};
