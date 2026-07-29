import { NextRequest, NextResponse } from "next/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const nonce = request.nextUrl.searchParams.get("nonce") || "";

  if (!UUID_PATTERN.test(nonce)) {
    return NextResponse.json({ error: "Invalid native authentication request." }, { status: 400 });
  }

  const response = NextResponse.redirect(
    new URL("/login?platform=mac&autostart=1", request.url),
    302,
  );
  response.cookies.set("cc_mac_handoff", nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 10 * 60,
  });
  return response;
}
