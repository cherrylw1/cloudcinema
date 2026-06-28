"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Menu, Search, Sun, Moon, User as UserIcon } from "lucide-react";
import { navigationItems } from "@/config/navigation";
import { SupabaseAuthRepository } from "@/repositories/auth/supabase-auth-repository";
import type { User as AuthUser } from "@/repositories/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TopBarProps {
  onOpenSidebar: () => void;
}

export function TopBar({ onOpenSidebar }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  // Avoid hydration mismatch and fetch user session
  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      setMounted(true);
    });

    const fetchUser = async () => {
      try {
        const authRepo = new SupabaseAuthRepository();
        const currentUser = await authRepo.getCurrentUser();
        setUser(currentUser);
      } catch {
        // Suppress auth exceptions on header init
      }
    };

    fetchUser();
    return () => cancelAnimationFrame(handle);
  }, []);

  const handleSignOut = async () => {
    try {
      const authRepo = new SupabaseAuthRepository();
      await authRepo.signOut();
      router.push("/login");
    } catch {
      // Suppress sign-out errors
    }
  };

  // Find page title from path
  const getPageTitle = () => {
    if (pathname === "/") return "Home";
    const item = navigationItems.find((n) => n.href === pathname);
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

        {/* User profile avatar dropdown */}
        {mounted && user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/30 text-foreground/80 hover:bg-card/60 transition-all duration-200 cursor-pointer outline-none">
                <Avatar size="sm" className="h-8 w-8">
                  {user.avatarUrl && (
                    <AvatarImage src={user.avatarUrl} alt={user.displayName || user.email} />
                  )}
                  <AvatarFallback className="bg-brand-primary/10 text-brand-primary text-xs font-semibold">
                    {user.displayName
                      ? user.displayName.slice(0, 2).toUpperCase()
                      : user.email.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-card border-border">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-foreground">
                    {user.displayName || "User"}
                  </p>
                  <p className="text-xs leading-none text-foreground/60 truncate">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-red-500 focus:bg-red-500/10 focus:text-red-500 cursor-pointer"
              >
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/30 text-foreground/80">
            <UserIcon className="h-4.5 w-4.5" />
          </div>
        )}
      </div>
    </header>
  );
}
