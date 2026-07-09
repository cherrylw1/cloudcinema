"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { SelectionProvider } from "@/providers/SelectionProvider";
import { createClient } from "@/clients/supabase/browser";
import { FluidBackground } from "@/components/ui/FluidBackground";
import { AnimatePresence, motion } from "framer-motion";
import { PreloadingScreen } from "@/components/common/PreloadingScreen";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Check if preloader has already run in this session
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasLoaded = sessionStorage.getItem("cherry_preloader_run");
      if (hasLoaded) {
        setIsLoading(false);
      } else {
        const timer = setTimeout(() => {
          setIsLoading(false);
          sessionStorage.setItem("cherry_preloader_run", "true");
        }, 2500); // 2.5 seconds loading duration matching progress animation
        return () => clearTimeout(timer);
      }
    }
  }, []);

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
      <AnimatePresence mode="wait">
        {isLoading ? (
          <PreloadingScreen key="preloader" />
        ) : (
          <motion.div
            key="app-content"
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
            className="min-h-screen bg-background text-foreground transition-colors duration-300 relative"
          >
            {/* Dynamic ambient fluid background blobs (Drifting lava lamp nebula) */}
            <FluidBackground />

            {/* Sidebar Navigation */}
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            {/* Main Content Area */}
            <div className="flex flex-col min-h-screen md:pl-64 relative z-10">
              {/* Top Navigation */}
              <TopBar onOpenSidebar={() => setIsSidebarOpen(true)} />

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
          </motion.div>
        )}
      </AnimatePresence>
    </SelectionProvider>
  );
}
