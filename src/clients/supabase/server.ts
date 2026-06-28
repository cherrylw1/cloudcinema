import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/config/env";
import { AppError } from "@/lib/errors";

/**
 * Creates a Supabase client for use in Server Components, Server Actions, or Route Handlers.
 * Throws AppError if Supabase configuration environment variables are missing.
 */
export async function createClient() {
  const url = env.supabaseUrl;
  const anonKey = env.supabaseAnonKey;

  if (!url || !anonKey) {
    throw new AppError(
      "Supabase server client cannot be initialized: URL or Anon Key is missing in environment variables.",
      "SUPABASE_CONFIG_ERROR",
      true
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // Next.js throws an error if cookies are written inside a render phase.
          // This can be ignored if a middleware handles refreshing user sessions.
        }
      },
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
