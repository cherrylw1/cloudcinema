"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Menu, Search, Sun, Moon, User } from "lucide-react";
import { siteConfig } from "@/config/site";

interface TopBarProps {
  onOpenSidebar: () => void;
}

export function TopBar({ onOpenSidebar }: TopBarProps) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  // Find page title from path
  const getPageTitle = () => {
    if (pathname === "/") return "Home";
    const item = siteConfig.navItems.find((n) => n.href === pathname);
    return item ? item.label : "CloudCinema";
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-background/40 px-6 backdrop-blur-md">
      {/* Left side: Hamburger (mobile) & Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenSidebar}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground/80 hover:text-foreground md:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
            {getPageTitle()}
          </h1>
        </div>
      </div>

      {/* Right side: Search placeholder, Theme toggle, Avatar */}
      <div className="flex items-center gap-4">
        {/* Search Input Placeholder */}
        <div className="relative hidden w-64 sm:block">
          <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <input
            type="text"
            placeholder="Search movies, shows..."
            disabled
            className="w-full rounded-xl border border-border bg-card/50 py-1.5 pr-4 pl-10 text-sm text-foreground placeholder-foreground/40 outline-none transition-all duration-200 cursor-not-allowed"
          />
        </div>

        {/* Theme Toggle Button */}
        {mounted && (
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/30 text-foreground/80 hover:bg-card/60 hover:text-foreground transition-all duration-200"
            title={`Switch to ${resolvedTheme === "dark" ? "Light" : "Dark"} Mode`}
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-4.5 w-4.5" />
            ) : (
              <Moon className="h-4.5 w-4.5" />
            )}
          </button>
        )}

        {/* User profile avatar placeholder */}
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/30 text-foreground/80 hover:bg-card/60 transition-all duration-200 cursor-not-allowed">
          <User className="h-4.5 w-4.5" />
        </div>
      </div>
    </header>
  );
}
