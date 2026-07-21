import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const completionPage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>Open CloudCinema</title>
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
    <p>Open CloudCinema to finish signing in.</p>
    <a id="open-app" href="#">Open CloudCinema</a>
    <small>You can close this tab after the app opens.</small>
  </main>
  <script>
    const hash = window.location.hash.slice(1);
    const intentUrl = "intent://auth-callback?" + hash + "#Intent;scheme=cloudcinema;package=com.cloudcinema.app;end";
    const link = document.getElementById("open-app");
    link.href = intentUrl;
    link.addEventListener("click", function () { window.location.href = intentUrl; });
  </script>
</body>
</html>`;

export async function GET() {
  return new NextResponse(completionPage, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
