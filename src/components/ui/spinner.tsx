import React from "react";
import { cn } from "@/lib/cn";

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl";
}

export function Spinner({ size = "md", className, ...props }: SpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-3",
    lg: "h-12 w-12 border-4",
    xl: "h-16 w-16 border-4",
  };

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-t-brand-primary border-r-transparent border-b-transparent border-l-transparent",
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="Loading"
      {...props}
    />
  );
}
