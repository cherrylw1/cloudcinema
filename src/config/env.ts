/**
 * Strict Environment Variable Validation
 * Throws immediately on load if required environment variables are missing or malformed.
 */

const getEnv = (key: string, defaultValue?: string, required = false): string => {
  const value = process.env[key] || defaultValue;
  if (required && !value) {
    throw new Error(`[Env Validation] Required environment variable "${key}" is missing.`);
  }
  return value || "";
};

const validateUrl = (url: string): string => {
  try {
    new URL(url);
    return url;
  } catch {
    throw new Error(`[Env Validation] Invalid URL format for NEXT_PUBLIC_APP_URL: "${url}"`);
  }
};

// Directly reference NEXT_PUBLIC_ variables as literals for build-time compilation support in browser bundles
const rawAppName = process.env.NEXT_PUBLIC_APP_NAME || "CloudCinema";
const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const rawSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const env = {
  // Required
  appName: rawAppName,
  appUrl: validateUrl(rawAppUrl),
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV === "development",

  // Optional (Supabase Integration Placeholders)
  supabaseUrl: rawSupabaseUrl,
  supabaseAnonKey: rawSupabaseAnonKey,
  supabaseServiceRoleKey: getEnv("SUPABASE_SERVICE_ROLE_KEY"),

  // Optional (Google Drive Integration Placeholders)
  googleClientId: getEnv("GOOGLE_CLIENT_ID"),
  googleClientSecret: getEnv("GOOGLE_CLIENT_SECRET"),
  googleRedirectUri: getEnv("GOOGLE_REDIRECT_URI"),
  googleDriveFolderId: getEnv("GOOGLE_DRIVE_FOLDER_ID"),
  googleRefreshToken: getEnv("GOOGLE_REFRESH_TOKEN"),

  // Optional (TMDB Integration Placeholders)
  tmdbApiKey: getEnv("TMDB_API_KEY"),
  tmdbAccessToken: getEnv("TMDB_ACCESS_TOKEN"),

  // Optional (AniSkip / Subtitles Integration Placeholders)
  aniSkipApiUrl: getEnv("ANISKIP_API_URL"),
  openSubtitlesApiKey: getEnv("OPENSUBTITLES_API_KEY"),
} as const;

export type Env = typeof env;
