import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/config/env";
import { updateSession } from "@/clients/supabase/middleware";

export async function proxy(request: NextRequest) {
  // 1. Refresh user session via cookies
  let response = await updateSession(request);

  const url = env.supabaseUrl;
  const anonKey = env.supabaseAnonKey;
  if (!url || !anonKey) {
    return response;
  }

  // 2. Create local client reading refreshed cookie headers
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // 3. Resolve user identity details
  const { data: { user } } = await supabase.auth.getUser();

  const nextUrl = request.nextUrl;
  const pathname = nextUrl.pathname;

  const isAuthRoute = pathname.startsWith("/api/auth");
  const isStreamRoute = pathname.startsWith("/api/stream");
  const isSubtitlesRoute = pathname.startsWith("/api/subtitles");
  const isLoginRoute = pathname === "/login";
  const isPendingRoute = pathname === "/pending-approval";

  if (isAuthRoute || isStreamRoute || isSubtitlesRoute) {
    return response;
  }

  // 4. Redirect unauthenticated users to /login, or return 401 for API routes
  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }
    if (!isLoginRoute) {
      const redirectUrl = nextUrl.clone();
      redirectUrl.pathname = "/login";
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  // 5. Query user approval status from public.profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_approved")
    .eq("id", user.id)
    .maybeSingle();

  const isApproved = profile?.is_approved ?? false;

  // 6. Redirect unapproved authenticated users to /pending-approval, or return 403 for API routes
  if (!isApproved) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Pending approval." }, { status: 403 });
    }
    if (!isPendingRoute && !isLoginRoute) {
      const redirectUrl = nextUrl.clone();
      redirectUrl.pathname = "/pending-approval";
      return NextResponse.redirect(redirectUrl);
    }
  } else {
    // Redirect approved users away from auth gates back to dashboard
    if (isLoginRoute || isPendingRoute) {
      const redirectUrl = nextUrl.clone();
      redirectUrl.pathname = "/";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - files ending in assets extensions (e.g. svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
