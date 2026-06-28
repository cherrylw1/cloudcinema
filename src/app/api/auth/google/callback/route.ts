import { NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(new URL(next, request.url));
      }
    } catch {
      // Suppress execution exceptions during session exchange
    }
  }

  // Redirect to login page on failure
  return NextResponse.redirect(
    new URL("/login?error=oauth_failed", request.url)
  );
}
