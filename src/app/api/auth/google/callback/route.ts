import { NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";
import {
  nativeCallbackHeaders,
  nativeCallbackPage,
} from "@/lib/auth/native-callback-page";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";
  const isNative = requestUrl.searchParams.get("source") === "app";

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data?.session) {
        if (isNative) {
          return new NextResponse(
            nativeCallbackPage(
              data.session.access_token,
              data.session.refresh_token,
            ),
            { headers: nativeCallbackHeaders },
          );
        }
        return NextResponse.redirect(new URL(next, request.url));
      }
    } catch {
      // Suppress execution exceptions during session exchange
    }
  }

  // Redirect to login page on failure
  return NextResponse.redirect(
    new URL(`/login?error=oauth_failed${isNative ? "&platform=app" : ""}`, request.url)
  );
}
