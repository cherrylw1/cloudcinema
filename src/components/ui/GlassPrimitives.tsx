import React from "react";
import { cn } from "@/lib/cn";

interface BaseGlassProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function GlassSurface({ children, className, ...props }: BaseGlassProps) {
  return (
    <div
      className={cn(
        "glass rounded-2xl p-6 text-card-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function GlassContainer({ children, className, ...props }: BaseGlassProps) {
  return (
    <div
      className={cn(
        "w-full rounded-3xl bg-background/30 border border-border/40 backdrop-blur-xl p-6 sm:p-8 shadow-2xl",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function GlassOverlay({ children, className, ...props }: BaseGlassProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-40 bg-background/60 backdrop-blur-md transition-opacity duration-300",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function GlassSection({ children, className, ...props }: BaseGlassProps) {
  return (
    <section
      className={cn(
        "rounded-2xl bg-card/10 border border-border/20 backdrop-blur-lg p-5 sm:p-6 shadow-md",
        className
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function GlassDivider({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "h-[1px] w-full bg-gradient-to-r from-transparent via-border to-transparent opacity-60",
        className
      )}
      {...props}
    />
  );
}
