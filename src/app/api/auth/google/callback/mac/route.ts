import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const handoff = request.cookies.get("cc_mac_handoff")?.value;
  const [portValue, nonce] = handoff?.split(":") ?? [];
  const port = Number(portValue);

  if (code && nonce && UUID_PATTERN.test(nonce) && port >= 1024 && port <= 65535) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data?.session) {
        const callbackUrl = new URL(`http://127.0.0.1:${port}/callback`);
        callbackUrl.searchParams.set("nonce", nonce);
        callbackUrl.searchParams.set("access_token", data.session.access_token);
        callbackUrl.searchParams.set("refresh_token", data.session.refresh_token);
        const response = NextResponse.redirect(callbackUrl, 302);
        response.cookies.delete("cc_mac_handoff");
        return response;
      }
    } catch {
      // The native client presents a useful error when the callback cannot complete.
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=oauth_failed&platform=mac", request.url),
  );
}
