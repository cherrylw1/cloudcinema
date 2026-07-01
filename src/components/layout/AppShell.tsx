"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { SelectionProvider } from "@/providers/SelectionProvider";
import { createClient } from "@/clients/supabase/browser";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("platform") === "app" || window.location.href.includes("platform=app")) {
        localStorage.setItem("platform", "app");
      }
    }
  }, []);

  useEffect(() => {
    const isNative = typeof window !== "undefined" && (
      ((window as any).Capacitor && (window as any).Capacitor.isNativePlatform()) ||
      (typeof navigator !== "undefined" && (navigator.userAgent.includes("CloudCinemaAndroid") || navigator.userAgent.includes("CloudCinemaIOS"))) ||
      localStorage.getItem("platform") === "app"
    );
    if (!isNative) return;

    import("@capacitor/app").then(({ App }) => {
      App.addListener("appUrlOpen", async (event) => {
        const url = event.url;
        if (!url) return;

        if (url.startsWith("cloudcinema://auth-callback")) {
          const hashIndex = url.indexOf("#");
          if (hashIndex === -1) return;
          const hashString = url.substring(hashIndex + 1);

          const params = new URLSearchParams(hashString);
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
                router.push("/");
                router.refresh();
              }
            } catch (err) {
              console.error("Error setting native session:", err);
            }
          }
        }
      });
    });
  }, [router]);

  return (
    <SelectionProvider>
      {/* Root container with ambient background gradient */}
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300 relative">
        {/* Subtle ambient background radial glow */}
        <div
          className="pointer-events-none fixed inset-0 z-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(229,9,20,0.05) 0%, transparent 50%)",
          }}
        />

        {/* Sidebar Navigation */}
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        {/* Main Content Area */}
        <div className="flex flex-col min-h-screen md:pl-64 relative z-10">
          {/* Top Navigation */}
          <TopBar onOpenSidebar={() => setIsSidebarOpen(true)} />

          {/* Content Container */}
          <main className="flex-1 p-6 pb-24 md:p-8 md:pb-8 max-w-7xl w-full mx-auto animate-fade-in">
            {children}
          </main>
        </div>

        {/* Mobile Bottom Navigation Bar */}
        <BottomNavBar />
      </div>
    </SelectionProvider>
  );
}
