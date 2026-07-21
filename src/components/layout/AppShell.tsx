"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { SelectionProvider } from "@/providers/SelectionProvider";
import { createClient } from "@/clients/supabase/browser";
import { FluidBackground } from "@/components/ui/FluidBackground";
import { rememberNativeApp } from "@/lib/platform";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNative, setIsNative] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const handledAuthUrl = useRef<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const native = rememberNativeApp();
    const frame = requestAnimationFrame(() => setIsNative(native));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!isNative) return;

    let disposed = false;
    const listeners: Array<{ remove: () => Promise<void> }> = [];

    import("@capacitor/app").then(async ({ App }) => {
      if (disposed) return;
      const handleAuthUrl = async (url: string | undefined) => {
        if (!url) return;

        if (url.startsWith("cloudcinema://auth-callback")) {
          if (handledAuthUrl.current === url) return;
          handledAuthUrl.current = url;

          const callbackUrl = new URL(url);
          const params = callbackUrl.searchParams.size > 0
            ? callbackUrl.searchParams
            : new URLSearchParams(callbackUrl.hash.slice(1));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");

          if (accessToken && refreshToken) {
            try {
              const supabase = createClient();
              const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (!error) {
                router.replace("/");
                router.refresh();
              } else {
                handledAuthUrl.current = null;
              }
            } catch (err) {
              handledAuthUrl.current = null;
              console.error("Error setting native session:", err);
            }
          }
        }
      };

      const launchUrl = await App.getLaunchUrl();
      await handleAuthUrl(launchUrl?.url);
      listeners.push(await App.addListener("appUrlOpen", (event) => handleAuthUrl(event.url)));

      listeners.push(await App.addListener("backButton", ({ canGoBack }) => {
        if (isSidebarOpen) {
          setIsSidebarOpen(false);
        } else if (canGoBack || pathname !== "/") {
          router.back();
        } else {
          App.exitApp();
        }
      }));
    });

    return () => {
      disposed = true;
      listeners.forEach((listener) => void listener.remove());
    };
  }, [isNative, isSidebarOpen, pathname, router]);

  useEffect(() => {
    if (!isNative) return;
    const updateConnection = () => setIsOffline(!navigator.onLine);
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, [isNative]);

  return (
    <SelectionProvider>
      <div
        className="min-h-screen bg-background text-foreground transition-colors duration-300 relative"
        data-native-app={isNative ? "true" : "false"}
      >
            {/* Dynamic ambient fluid background blobs (Drifting lava lamp nebula) */}
            {!isNative && <FluidBackground />}

            {/* Sidebar Navigation */}
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            {/* Main Content Area */}
            <div className="flex flex-col min-h-screen md:pl-64 relative z-10">
              {/* Top Navigation */}
              <TopBar onOpenSidebar={() => setIsSidebarOpen(true)} />

              {isOffline && (
                <div className="native-offline-banner" role="status">
                  You are offline. Reconnect to load your library.
                  <button type="button" onClick={() => window.location.reload()}>Retry</button>
                </div>
              )}

              {/* Content Container */}
              <main 
                key={pathname}
                className="flex-1 p-6 pb-24 md:p-8 md:pb-8 max-w-7xl w-full mx-auto animate-fade-in"
              >
                {children}
              </main>
            </div>

            {/* Mobile Bottom Navigation Bar */}
            <BottomNavBar />
      </div>
    </SelectionProvider>
  );
}
