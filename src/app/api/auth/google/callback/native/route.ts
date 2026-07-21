import { NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";
import {
  nativeCallbackHeaders,
  nativeCallbackPage,
} from "@/lib/auth/native-callback-page";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error && data.session) {
        return new NextResponse(
          nativeCallbackPage(data.session.access_token, data.session.refresh_token),
          {
            headers: nativeCallbackHeaders,
          },
        );
      }
    } catch {
      // The failure page below lets the user restart authentication cleanly.
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=oauth_failed&platform=app", request.url),
  );
}
