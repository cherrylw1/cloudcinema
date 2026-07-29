import { NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";
  const source = requestUrl.searchParams.get("source");
  const isNative = source === "app";
  const isMac = source === "mac";

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data?.session) {
        if (isMac) {
          const callbackUrl = new URL("cloudcinema-mac://auth-callback");
          callbackUrl.searchParams.set("access_token", data.session.access_token);
          callbackUrl.searchParams.set("refresh_token", data.session.refresh_token);
          return NextResponse.redirect(callbackUrl, 302);
        }
        if (isNative) {
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
        return NextResponse.redirect(new URL(next, request.url));
      }
    } catch {
      // Suppress execution exceptions during session exchange
    }
  }

  // Redirect to login page on failure
  return NextResponse.redirect(
    new URL(
      `/login?error=oauth_failed${
        isNative ? "&platform=app" : isMac ? "&platform=mac" : ""
      }`,
      request.url,
    )
  );
}
