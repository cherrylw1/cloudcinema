"use client";

import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { Play } from "lucide-react";
import type { Media } from "@/repositories/media";
import { useSelection } from "@/providers/SelectionProvider";

interface MediaCardProps {
  media: Media;
}

export function MediaCard({ media }: MediaCardProps) {
  const { isSelectionMode, selectedIds, toggleSelect } = useSelection();
  const isSelected = selectedIds.includes(media.id);

  const handleClick = (e: React.MouseEvent) => {
    if (isSelectionMode) {
      e.preventDefault();
      e.stopPropagation();
      toggleSelect(media.id);
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSelect(media.id);
  };

  return (
    <Link href={`/watch/${media.id}`} onClick={handleClick} className="block group relative">
      <GlassCard className={`relative overflow-hidden flex flex-col justify-between aspect-video rounded-xl p-0 bg-card/10 hover:bg-card/25 border transition-all duration-300 cursor-pointer h-full ${
        isSelected ? "border-brand-primary/80 ring-2 ring-brand-primary/50" : "border-border/40"
      }`}>
        {/* Checkbox Overlay */}
        <div 
          onClick={handleCheckboxClick}
          className={`absolute top-3 left-3 z-30 transition-opacity duration-200 ${
            isSelectionMode ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <div className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
            isSelected 
              ? "bg-brand-primary border-brand-primary text-white" 
              : "bg-black/60 border-white/30 text-transparent hover:border-white/60"
          }`}>
            <svg className="h-3.5 w-3.5 fill-none stroke-current stroke-[2.5]" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {media.posterUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={media.posterUrl}
              alt={media.title}
              className="absolute inset-0 w-full h-full object-cover rounded-xl transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent rounded-xl z-10" />
          </>
        ) : null}

        {/* Play icon overlay on hover (only when not in selection mode) */}
        {!isSelectionMode && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-xl z-20">
            <div className="h-10 w-10 rounded-full bg-brand-primary text-white flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-300 shadow-lg">
              <Play className="h-5 w-5 fill-white ml-0.5" />
            </div>
          </div>
        )}

        <div className="flex flex-col h-full justify-between p-4 z-10 relative">
          <div className="flex justify-between items-start gap-2">
            <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
              media.posterUrl 
                ? "bg-black/60 border-white/10 text-white" 
                : "bg-card/75 border-border/30 text-foreground/80"
            }`}>
              {media.mediaType === "tv-show"
                ? "Episode"
                : media.mediaType === "anime"
                ? "Anime"
                : "Movie"}
            </span>

            {media.mediaType === "tv-show" && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                media.posterUrl
                  ? "bg-brand-primary border border-brand-primary/20 text-white shadow-md"
                  : "bg-brand-primary/15 border border-brand-primary/20 text-brand-primary"
              }`}>
                S{String(media.season ?? 0).padStart(2, "0")}E{String(media.episode ?? 0).padStart(2, "0")}
              </span>
            )}
          </div>

          <div className="mt-4 space-y-1">
            <h4 className={`font-semibold leading-snug line-clamp-2 text-xs md:text-sm ${
              media.posterUrl ? "text-white drop-shadow-md" : "text-foreground"
            }`}>
              {media.mediaType === "tv-show" && media.series ? media.series : media.title}
            </h4>
            {media.mediaType === "tv-show" && media.title && (
              <p className={`text-[10px] truncate font-normal ${
                media.posterUrl ? "text-white/70 drop-shadow-sm" : "text-foreground/40"
              }`}>
                {media.title}
              </p>
            )}
            {media.fileSize && (
              <p className={`text-[9px] font-mono pt-0.5 ${
                media.posterUrl ? "text-white/50" : "text-foreground/35"
              }`}>
                {(media.fileSize / (1024 * 1024 * 1024)).toFixed(2)} GB
              </p>
            )}
          </div>
        </div>
      </GlassCard>
    </Link>
  );
}
