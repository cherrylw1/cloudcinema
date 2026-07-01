"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Home, Search, FolderHeart, Bookmark, Settings } from "lucide-react";

export function BottomNavBar() {
  const pathname = usePathname();

  const mobileNavItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Search", href: "/search", icon: Search },
    { label: "Library", href: "/library", icon: FolderHeart },
    { label: "Watchlist", href: "/watchlist", icon: Bookmark },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden flex h-16 items-center justify-around px-2 border-t"
      style={{
        background: "rgba(8, 8, 15, 0.85)",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
        borderTopColor: "rgba(255, 255, 255, 0.07)",
        boxShadow: "0 -2px 10px rgba(0, 0, 0, 0.5)",
      }}
    >
      {mobileNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center justify-center flex-1 h-full py-2 gap-1 group relative"
          >
            {/* Active glow indicator pill */}
            <div
              className={cn(
                "flex items-center justify-center w-12 h-7 rounded-full transition-all duration-300",
                isActive
                  ? "bg-white/[0.08] text-white"
                  : "text-white/40 group-hover:text-white/70 group-hover:bg-white/[0.04]"
              )}
            >
              <Icon className="h-4.5 w-4.5" />
            </div>
            
            {/* Label */}
            <span
              className={cn(
                "text-[10px] font-medium tracking-tight transition-colors duration-200",
                isActive ? "text-white font-semibold" : "text-white/40"
              )}
            >
              {item.label}
            </span>

            {/* Micro active line indicator */}
            {isActive && (
              <span
                className="absolute bottom-1.5 h-[2px] w-6 rounded-full bg-brand-primary"
                style={{
                  boxShadow: "0 0 6px rgba(229, 9, 20, 0.8)",
                }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
