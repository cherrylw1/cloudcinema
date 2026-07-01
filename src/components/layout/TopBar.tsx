"use client";

import { useEffect, useState, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

  const getPageTitle = () => {
    if (pathname === "/") return "Home";
    const item = navigationItems.find((n) => n.href === pathname);
    return item ? item.label : "CloudCinema";
  };

  return (
    <header
      className="sticky top-0 z-30 flex h-14 w-full items-center justify-between px-5"
      style={{
        background: "rgba(8, 8, 15, 0.75)",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        boxShadow: "0 1px 0 rgba(255, 255, 255, 0.04)",
      }}
    >
      {/* Left side: Hamburger (mobile) & Title */}
      <div className="flex items-center gap-3.5">
        <button
          onClick={onOpenSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.09] text-white/70 hover:text-white hover:bg-white/[0.10] transition-all duration-200 md:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>
        <div>
          <h1 className="text-base font-semibold tracking-[-0.02em] text-white/90 md:text-[17px]">
            {getPageTitle()}
          </h1>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2.5">
        {/* Search — pill shape, glass inset */}
        <Suspense fallback={
          <div className="relative hidden w-56 sm:block">
            <div className="w-full h-8 rounded-full bg-white/[0.05] border border-white/[0.08] animate-pulse" />
          </div>
        }>
          <SearchInputWrapper />
        </Suspense>

        {/* Theme Toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] border border-white/[0.09] text-white/60 hover:bg-white/[0.10] hover:text-white/90 transition-all duration-200"
            title={`Switch to ${resolvedTheme === "dark" ? "Light" : "Dark"} Mode`}
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        )}

        {/* User Avatar / Dropdown */}
        {mounted && user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] border border-white/[0.09] hover:bg-white/[0.10] transition-all duration-200 cursor-pointer outline-none">
                <Avatar size="sm" className="h-7 w-7">
                  {user.avatarUrl && (
                    <AvatarImage src={user.avatarUrl} alt={user.displayName || user.email} />
                  )}
                  <AvatarFallback className="bg-brand-primary/20 text-brand-primary text-[10px] font-bold">
                    {user.displayName
                      ? user.displayName.slice(0, 2).toUpperCase()
                      : user.email.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52 border-white/[0.09]"
              style={{
                background: "rgba(20, 20, 30, 0.95)",
                backdropFilter: "blur(40px)",
                WebkitBackdropFilter: "blur(40px)",
              }}
            >
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-0.5">
                  <p className="text-sm font-semibold leading-none text-white/90">
                    {user.displayName || "User"}
                  </p>
                  <p className="text-xs leading-none text-white/40 truncate mt-1">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/[0.07]" />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer"
              >
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] border border-white/[0.09] text-white/40">
            <UserIcon className="h-4 w-4" />
          </div>
        )}
      </div>
    </header>
  );
}

function SearchInputWrapper() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  return <SearchInput key={q} initialQuery={q} />;
}

function SearchInput({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [focused, setFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative hidden w-56 sm:block">
      <Search
        className={`absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 transition-colors duration-200 ${
          focused ? "text-white/70" : "text-white/30"
        }`}
      />
      <input
        type="text"
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full rounded-full py-1.5 pr-4 pl-9 text-sm text-white/90 placeholder-white/30 outline-none transition-all duration-200"
        style={{
          background: focused ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.05)",
          border: `1px solid ${focused ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)"}`,
          boxShadow: focused ? "0 0 0 3px rgba(229,9,20,0.12)" : "none",
        }}
      />
    </form>
  );
}
