import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";

const HANDOFF_PATTERN =
  /^(?<port>\d{4,5}):(?<nonce>[0-9a-f]{8}-[0-9a-f-]{27,})$/i;

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const handoff = request.cookies.get("cc_mac_handoff")?.value;
  const match = handoff?.match(HANDOFF_PATTERN);
  const port = Number(match?.groups?.port);
  const nonce = match?.groups?.nonce;

  if (code && nonce && port >= 1024 && port <= 65535) {
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
