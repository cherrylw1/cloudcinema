"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SeriesCard } from "@/components/media/SeriesCard";
import type { Media } from "@/repositories/media";

interface MediaRowProps {
  title: string;
  items: Media[];
  /** Portrait cards (posters) vs landscape (backdrops) */
  variant?: "portrait" | "landscape";
  description?: string;
}

export function MediaRow({ title, items, variant = "portrait", description }: MediaRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

  const scroll = (dir: "left" | "right") => {
    if (!rowRef.current) return;
    const amount = rowRef.current.clientWidth * 0.75;
    rowRef.current.scrollBy({ left: dir === "right" ? amount : -amount, behavior: "smooth" });
  };

  return (
    <div className="space-y-3 group/row">
      {/* Section header with accent pip */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-3">
          <span className="block h-4 w-[3px] rounded-full bg-brand-primary opacity-80" />
          <h2 className="text-sm font-bold tracking-wider uppercase text-foreground/80">
            {title}
          </h2>
        </div>
        {description && (
          <p className="text-[11px] text-white/45 pl-[15px] leading-snug">
            {description}
          </p>
        )}
      </div>

      <div className="relative">
        {/* Left scroll arrow */}
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20 hidden h-9 w-9 rounded-full items-center justify-center opacity-0 transition-all duration-200 hover:scale-110 cursor-pointer md:flex md:group-hover/row:opacity-100"
          style={{
            background: "rgba(20,20,30,0.85)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.14)",
            color: "white",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Scrollable row */}
        <div
          ref={rowRef}
          className="flex gap-3 overflow-x-auto overscroll-x-contain pb-2 scrollbar-none touch-auto sm:gap-4"
          style={{
            scrollSnapType: "x proximity",
            overscrollBehaviorX: "contain",
            overscrollBehaviorY: "auto",
            touchAction: "pan-x pan-y",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {items.map((media) => (
            <div
              key={media.id}
              className={
                variant === "portrait"
                  ? "w-[8.5rem] flex-shrink-0 sm:w-44 md:w-48"
                  : "w-[18rem] flex-shrink-0 sm:w-72 md:w-80"
              }
              style={{ scrollSnapAlign: "start" }}
            >
              <SeriesCard media={media} horizontal={variant === "portrait"} />
            </div>
          ))}
        </div>

        {/* Right scroll arrow */}
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-20 hidden h-9 w-9 rounded-full items-center justify-center opacity-0 transition-all duration-200 hover:scale-110 cursor-pointer md:flex md:group-hover/row:opacity-100"
          style={{
            background: "rgba(20,20,30,0.85)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.14)",
            color: "white",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
          aria-label="Scroll right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
