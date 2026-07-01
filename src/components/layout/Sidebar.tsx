"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { navigationItems } from "@/config/navigation";
import { getCurrentYear } from "@/lib/format";
import { Logo } from "@/components/common/Logo";
import {
  Home,
  FolderHeart,
  Film,
  Tv,
  Sparkles,
  Settings,
  Bookmark,
  Heart,
  X,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Home,
  FolderHeart,
  Film,
  Tv,
  Sparkles,
  Settings,
  Bookmark,
  Heart,
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity duration-300 md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col p-5 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] md:translate-x-0",
          // Glass effect
          "border-r bg-[rgba(10,10,18,0.88)] backdrop-blur-[40px] border-white/[0.07]",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header / Logo */}
        <div className="flex items-center justify-between pb-6 mb-2">
          <Link href="/" onClick={onClose} className="group">
            {/* Wrap logo in subtle glow container */}
            <div className="relative">
              <div className="absolute -inset-2 rounded-xl bg-brand-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md" />
              <Logo />
            </div>
          </Link>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] border border-white/[0.1] text-white/50 hover:text-white/90 hover:bg-white/[0.1] transition-all duration-200 md:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Thin divider */}
        <div className="w-full h-px bg-white/[0.06] mb-4" />

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1">
          {navigationItems.map((item) => {
            const Icon = typeof item.icon === "string" ? (iconMap[item.icon] || Home) : item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-white/[0.12] text-white"
                    : "text-white/50 hover:bg-white/[0.06] hover:text-white/90"
                )}
              >
                {/* Active left accent bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-brand-primary shadow-[0_0_8px_rgba(229,9,20,0.7)]" />
                )}
                <Icon
                  className={cn(
                    "h-4.5 w-4.5 shrink-0 transition-colors duration-200",
                    isActive ? "text-white" : "text-white/40"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="border-t border-white/[0.06] pt-4 mt-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-white/25 font-medium">CloudCinema</p>
            <span className="text-[10px] text-white/20 bg-white/[0.05] border border-white/[0.07] px-2 py-0.5 rounded-full">
              v0.2
            </span>
          </div>
          <p className="text-[10px] text-white/15 mt-0.5">© {getCurrentYear()}</p>
        </div>
      </aside>
    </>
  );
}
