import { env } from "@/config/env";
import { type AppConfig } from "@/types";

export const appConfig: AppConfig = {
  name: env.appName,
  version: "0.2.0",
  defaultTheme: "dark",
  defaultLanguage: "en",
  layout: {
    sidebarWidth: 256,
    mobileBreakpoint: 768,
  },
  animation: {
    defaultDuration: 0.2,
    defaultEase: "easeOut",
  },
  features: {
    enableAuthentication: false,
    enableGoogleDrive: false,
    enableSupabase: false,
  },
};
