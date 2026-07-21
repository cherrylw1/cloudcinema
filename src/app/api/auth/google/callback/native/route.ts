import { NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";

export const dynamic = "force-dynamic";

function callbackPage(accessToken: string, refreshToken: string) {
  const query = new URLSearchParams({
    access_token: accessToken,
    refresh_token: refreshToken,
  }).toString();
  const intentUrl = `intent://auth-callback?${query}#Intent;scheme=cloudcinema;package=com.cloudcinema.app;end`;
  const serializedIntentUrl = JSON.stringify(intentUrl).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>Return to CloudCinema</title>
  <style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#08080f;color:#f5f5f7;font-family:system-ui,sans-serif;padding:24px;text-align:center}
    main{max-width:420px}h1{font-size:24px;margin:0 0 10px}p{color:#b7b7c2;line-height:1.5;margin:0 0 22px}
    a{display:inline-flex;min-height:48px;align-items:center;justify-content:center;padding:0 22px;border-radius:8px;background:#e50914;color:#fff;font-weight:700;text-decoration:none}
    small{display:block;margin-top:18px;color:#777786}
  </style>
</head>
<body>
  <main>
    <h1>Google sign-in complete</h1>
    <p>Return to CloudCinema to finish opening your library.</p>
    <a href="${intentUrl}">Open CloudCinema</a>
    <small>You can close this tab after the app opens.</small>
  </main>
  <script>window.location.replace(${serializedIntentUrl});</script>
</body>
</html>`;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error && data.session) {
        return new NextResponse(
          callbackPage(data.session.access_token, data.session.refresh_token),
          {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store, max-age=0",
              "Referrer-Policy": "no-referrer",
              "X-Content-Type-Options": "nosniff",
            },
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
