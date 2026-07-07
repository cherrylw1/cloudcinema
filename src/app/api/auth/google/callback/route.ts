import { NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";
  const source = requestUrl.searchParams.get("source");

  // Check if this login request originated from the native app's WebView via our custom cookie
  const cookieHeader = request.headers.get("cookie") || "";
  const isWebview = cookieHeader.includes("auth_source=webview") || source === "webview";

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data?.session) {
        // If logged in via WebView, clear the cookie and redirect to '/' directly
        if (isWebview) {
          const response = NextResponse.redirect(new URL(next, request.url));
          response.cookies.set("auth_source", "", { maxAge: 0, path: "/" });
          return response;
        }

        if (source === "app") {
          const accessToken = data.session.access_token;
          const refreshToken = data.session.refresh_token;
          
          const html = `
            <!DOCTYPE html>
            <html>
              <head>
                <title>Redirecting...</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  body {
                    background-color: #08080f;
                    color: #ffffff;
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    text-align: center;
                    padding: 20px;
                  }
                  .spinner {
                    border: 3px solid rgba(255,255,255,0.1);
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    border-left-color: #e50914;
                    animation: spin 1s linear infinite;
                    margin-bottom: 20px;
                  }
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                  .btn {
                    margin-top: 20px;
                    background-color: #e50914;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-weight: bold;
                    text-decoration: none;
                    cursor: pointer;
                    display: inline-block;
                    box-shadow: 0 4px 14px rgba(229, 9, 20, 0.4);
                  }
                </style>
              </head>
              <body>
                <div class="spinner"></div>
                <h2 style="font-weight: 800; margin-bottom: 8px;">Logging you into the app...</h2>
                <p style="color: rgba(255,255,255,0.6); font-size: 14px; margin-bottom: 12px;">If you are not redirected automatically, tap below.</p>
                <a class="btn" href="cloudcinema://auth-callback#access_token=${accessToken}&refresh_token=${refreshToken}">Return to CloudCinema</a>
                <script>
                  const deepLinkUrl = "cloudcinema://auth-callback#access_token=${accessToken}&refresh_token=${refreshToken}";
                  window.location.replace(deepLinkUrl);
                  window.onload = function() {
                    setTimeout(function() {
                      window.location.href = deepLinkUrl;
                    }, 300);
                  };
                </script>
              </body>
            </html>
          `;

          return new NextResponse(html, {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
            },
          });
        }
        return NextResponse.redirect(new URL(next, request.url));
      }
    } catch {
      // Suppress execution exceptions during session exchange
    }
  }

  // Redirect to login page on failure
  return NextResponse.redirect(
    new URL("/login?error=oauth_failed", request.url)
  );
}
