import { createClient } from "@supabase/supabase-js";
import { env } from "@/config/env";
import { AppError } from "@/lib/errors";

/**
 * !!! SECURITY WARNING !!!
 * This is a server-only Supabase client initialized with the Service Role key.
 * It bypasses all Row Level Security (RLS) policies.
 * 
 * NEVER import this file into any client component, browser hook, or public bundle.
 * Doing so will leak your project's admin keys and compromise database security.
 */

export function createAdminClient() {
  const url = env.supabaseUrl;
  const serviceRoleKey = env.supabaseServiceRoleKey;

  if (!url || !serviceRoleKey) {
    throw new AppError(
      "Supabase admin client cannot be initialized: URL or Service Role Key is missing in environment variables.",
      "SUPABASE_CONFIG_ERROR",
      true
    );
  }

  // Ensure this is strictly executed in a server context
  if (typeof window !== "undefined") {
    throw new AppError(
      "Supabase admin client cannot be initialized in browser context.",
      "UNAUTHORIZED",
      true
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: (url, options) => {
        return fetch(url, {
          ...options,
          cache: "no-store",
        });
      },
    },
  });
}
