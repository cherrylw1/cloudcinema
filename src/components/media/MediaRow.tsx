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
      <h3 className="text-base font-semibold text-white/90 px-0">{title}</h3>
      <div className="relative">
        {/* Left Arrow */}
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-20 h-10 w-10 rounded-full bg-black/70 border border-white/20 text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity duration-200 hover:bg-black/90 cursor-pointer"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Scrollable row */}
        <div
          ref={rowRef}
          className="flex gap-3 overflow-x-auto scrollbar-none pb-2"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {items.map((media) => (
            <div key={media.id} style={{ scrollSnapAlign: "start" }}>
              <SeriesCard media={media} horizontal={variant === "portrait"} />
            </div>
          ))}
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-20 h-10 w-10 rounded-full bg-black/70 border border-white/20 text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity duration-200 hover:bg-black/90 cursor-pointer"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
