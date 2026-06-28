import React from "react";
import { cn } from "@/lib/cn";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function GlassCard({ children, className, ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        "glass glass-hover rounded-2xl p-5 text-card-foreground transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.01]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
