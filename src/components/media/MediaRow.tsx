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
}

export function MediaRow({ title, items, variant = "portrait" }: MediaRowProps) {
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
      <div className="flex items-center gap-3">
        <span className="block h-4 w-[3px] rounded-full bg-brand-primary opacity-80" />
        <h3 className="text-[15px] font-semibold text-white/90 tracking-tight">{title}</h3>
      </div>

      <div className="relative">
        {/* Left scroll arrow */}
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20 h-9 w-9 rounded-full flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-200 hover:scale-110 cursor-pointer"
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
          className="flex gap-3 overflow-x-auto scrollbar-none pb-2"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {items.map((media) => (
            <div
              key={media.id}
              className={
                variant === "portrait"
                  ? "w-44 sm:w-48 flex-shrink-0"
                  : "w-72 sm:w-80 flex-shrink-0"
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
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-20 h-9 w-9 rounded-full flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-200 hover:scale-110 cursor-pointer"
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
