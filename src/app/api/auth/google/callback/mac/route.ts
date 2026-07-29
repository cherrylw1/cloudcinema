import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clearHandoff(response: NextResponse) {
  response.cookies.set("cc_mac_handoff", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nonce = request.cookies.get("cc_mac_handoff")?.value;

  if (nonce && UUID_PATTERN.test(nonce)) {
    const callbackUrl = new URL("cloudcinema-mac-v2://auth-callback");
    callbackUrl.searchParams.set("nonce", nonce);

    try {
      if (code) {
        const supabase = await createClient();
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && data?.session) {
          callbackUrl.searchParams.set("access_token", data.session.access_token);
          callbackUrl.searchParams.set("refresh_token", data.session.refresh_token);
          return clearHandoff(NextResponse.redirect(callbackUrl, 302));
        }
      }
    } catch {
      // Return the failure through the registered app callback below.
    }

    callbackUrl.searchParams.set("error", "oauth_failed");
    return clearHandoff(NextResponse.redirect(callbackUrl, 302));
  }

  return NextResponse.redirect(
    new URL("/login?error=oauth_failed&platform=mac", request.url),
  );
}
