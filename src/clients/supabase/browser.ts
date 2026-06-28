import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/config/env";
import { AppError } from "@/lib/errors";

/**
 * Creates a Supabase client for use in browser/client components.
 * Throws AppError if Supabase configuration environment variables are missing.
 */
export function createClient() {
  const url = env.supabaseUrl;
  const anonKey = env.supabaseAnonKey;

  if (!url || !anonKey) {
    throw new AppError(
      "Supabase client cannot be initialized: URL or Anon Key is missing in environment variables.",
      "SUPABASE_CONFIG_ERROR",
      true
    );
  }

  return createBrowserClient(url, anonKey);
}
