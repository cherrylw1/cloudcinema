import { NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data?.session) {
        const callbackUrl = new URL("cloudcinema-mac://auth-callback");
        callbackUrl.searchParams.set("access_token", data.session.access_token);
        callbackUrl.searchParams.set("refresh_token", data.session.refresh_token);
        return NextResponse.redirect(callbackUrl, 302);
      }
    } catch {
      // The native client presents a useful error when the callback cannot complete.
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=oauth_failed&platform=mac", request.url),
  );
}
