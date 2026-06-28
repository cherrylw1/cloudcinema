import React from "react";
import { cn } from "@/lib/cn";

interface BaseFocusProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * FocusRing wraps an element and applies an animated, glowing focus ring.
 * Active on focus-within, designed to look premium and cinematic.
 */
export function FocusRing({ children, className, ...props }: BaseFocusProps) {
  return (
    <div
      className={cn(
        "relative rounded-xl transition-all duration-200 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-background outline-none",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * TVFocus provides styles tailored for Android TV D-Pad and gamepad navigation.
 * It uses high contrast borders and scale animations to make the active element stand out.
 */
export function TVFocus({ children, className, ...props }: BaseFocusProps) {
  return (
    <div
      className={cn(
        "relative rounded-xl transition-all duration-200 outline-none hover:scale-[1.02] focus-visible:scale-[1.03] focus-visible:ring-4 focus-visible:ring-primary focus-visible:border-transparent focus-visible:shadow-[0_0_20px_rgba(229,9,20,0.4)] border border-transparent",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * KeyboardFocus matches only when navigating via keyboard (tab index focus-visible).
 * Prevents focus outlines from appearing on mouse click events.
 */
export function KeyboardFocus({ children, className, ...props }: BaseFocusProps) {
  return (
    <div
      className={cn(
        "rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * HoverFocus unifies both hover mouse outlines and keyboard tab outlines.
 */
export function HoverFocus({ children, className, ...props }: BaseFocusProps) {
  return (
    <div
      className={cn(
        "rounded-xl transition-all duration-200 outline-none hover:ring-2 hover:ring-border/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
