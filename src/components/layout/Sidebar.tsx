"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import { Logo } from "@/components/common/Logo";
import {
  Home,
  FolderHeart,
  Film,
  Tv,
  Sparkles,
  Settings,
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
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card/95 p-6 transition-transform duration-300 ease-in-out md:translate-x-0 md:bg-card/20 md:backdrop-blur-xl",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header / Logo */}
        <div className="flex items-center justify-between pb-8">
          <Link href="/" onClick={onClose}>
            <Logo />
          </Link>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground/60 hover:text-foreground md:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5">
          {siteConfig.navItems.map((item) => {
            const Icon = iconMap[item.icon] || Home;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-brand-primary text-white shadow-[0_0_15px_rgba(229,9,20,0.25)]"
                    : "text-foreground/60 hover:bg-card/50 hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="border-t border-border pt-4 text-xs text-foreground/40">
          <p>© {new Date().getFullYear()} CloudCinema</p>
          <p className="mt-0.5">v0.1.0 Foundation</p>
        </div>
      </aside>
    </>
  );
}
