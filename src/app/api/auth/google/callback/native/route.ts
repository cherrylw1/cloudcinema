import { NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error && data.session) {
        const session = new URLSearchParams({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        const completionUrl = new URL(
          "https://cherrycinema.netlify.app/api/auth/android/complete",
        );
        completionUrl.hash = session.toString();
        return NextResponse.redirect(completionUrl, 302);
      }
    } catch {
      // The failure page below lets the user restart authentication cleanly.
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=oauth_failed&platform=app", request.url),
  );
}
