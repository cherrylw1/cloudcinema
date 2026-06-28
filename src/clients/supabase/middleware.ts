import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/config/env";

/**
 * Updates the user's Supabase session cookies inside the Next.js Middleware.
 * Bypasses checks if environment variables are not configured.
 */
export async function updateSession(request: NextRequest) {
  const url = env.supabaseUrl;
  const anonKey = env.supabaseAnonKey;

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh user session dynamically.
  try {
    await supabase.auth.getUser();
  } catch {
    // Suppress auth exceptions in middleware bootstrap
  }

  return response;
}
