"use client";

import Link from "next/link";
import { Play, Info } from "lucide-react";
import type { Media } from "@/repositories/media";

interface SeriesCardProps {
  /** Representative episode/movie for this series group */
  media: Media;
  /** If true, render as horizontal card (for Continue Watching row) */
  horizontal?: boolean;
}

export function SeriesCard({ media, horizontal = false }: SeriesCardProps) {
  const isEpisodic = media.mediaType === "tv-show" || media.mediaType === "anime";
  const displayTitle = isEpisodic && media.series ? media.series : media.title;
  
  let href = `/watch/${media.id}`;
  if (media.mediaType === "movie") {
    href = `/movies/${media.id}`;
  } else if (isEpisodic && media.series) {
    href = `/series/${encodeURIComponent(media.series)}`;
  }

  if (horizontal) {
    return (
      <Link href={href} className="block group w-full">
        <div className="relative overflow-hidden rounded-lg aspect-[2/3] bg-white/5 border border-white/10 transition-all duration-300 group-hover:scale-105 group-hover:z-10 group-hover:shadow-2xl group-hover:shadow-black/60">
          {media.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.posterUrl}
              alt={displayTitle}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/10 to-transparent">
              <span className="text-2xl font-bold text-white/30 text-center px-2 leading-tight line-clamp-3">{displayTitle}</span>
            </div>
          )}
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3 gap-2">
            <p className="text-white font-semibold text-sm leading-tight line-clamp-2">{displayTitle}</p>
            <div className="flex gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black">
                <Play className="h-3.5 w-3.5 fill-black ml-0.5" />
              </div>
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/50 text-white">
                <Info className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // Default: landscape/backdrop card for grids
  return (
    <Link href={href} className="block group">
      <div className="relative overflow-hidden rounded-xl aspect-video bg-white/5 border border-white/10 transition-all duration-300 group-hover:scale-105 group-hover:z-10 group-hover:shadow-2xl group-hover:shadow-black/60">
        {media.backdropUrl || media.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.backdropUrl || media.posterUrl || ""}
            alt={displayTitle}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/10 to-transparent">
            <span className="text-xl font-bold text-white/30 text-center px-4 leading-tight line-clamp-3">{displayTitle}</span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        {/* Play on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
            <Play className="h-5 w-5 fill-white text-white ml-0.5" />
          </div>
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${
              media.mediaType === "anime"
                ? "bg-purple-500/80 border-purple-400/30 text-white"
                : media.mediaType === "tv-show"
                ? "bg-blue-500/80 border-blue-400/30 text-white"
                : "bg-brand-primary/80 border-red-400/30 text-white"
            }`}>
              {media.mediaType === "anime" ? "Anime" : media.mediaType === "tv-show" ? "TV Show" : "Movie"}
            </span>
          </div>
          <h4 className="text-white font-semibold text-sm leading-tight line-clamp-1 drop-shadow-md">{displayTitle}</h4>
        </div>
      </div>
    </Link>
  );
}
