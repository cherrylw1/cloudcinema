import React from "react";
import { cn } from "@/lib/cn";

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function PageContainer({
  title,
  description,
  children,
  className,
  ...props
}: PageContainerProps) {
  return (
    <div className={cn("space-y-6", className)} {...props}>
      <div className="space-y-1.5 select-none">
        <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-foreground/60 md:text-base">
            {description}
          </p>
        )}
      </div>
      <div className="pt-2">{children}</div>
    </div>
  );
}
