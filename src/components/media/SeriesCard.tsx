"use client";

import Link from "next/link";
import { Play, Info } from "lucide-react";
import type { Media } from "@/repositories/media";

interface SeriesCardProps {
  media: Media;
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
        <div
          className="relative overflow-hidden rounded-2xl aspect-[2/3] transition-all duration-300"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}
        >
          {/* Inner image scales on hover while outer card stays still */}
          <div className="absolute inset-0 transition-transform duration-300 ease-out group-hover:scale-[1.04]">
            {media.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={media.posterUrl}
                alt={displayTitle}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                }}
              >
                <span className="relative text-xl font-bold text-white/20 text-center px-3 leading-tight line-clamp-3 tracking-tight">
                  {displayTitle}
                </span>
              </div>
            )}
          </div>

          {/* Static bottom gradient */}
          <div
            className="absolute inset-x-0 bottom-0 h-2/5 pointer-events-none"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)",
            }}
          />

          {/* Hover glass overlay with title and action buttons */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3 gap-2"
            style={{
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
          >
            <p className="text-white font-semibold text-xs leading-tight line-clamp-2 tracking-tight">
              {displayTitle}
            </p>
            <div className="flex gap-1.5">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full shadow-lg"
                style={{ background: "rgba(255,255,255,0.95)" }}
              >
                <Play className="h-3 w-3 fill-black text-black ml-0.5" />
              </div>
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full"
                style={{
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                <Info className="h-3 w-3 text-white" />
              </div>
            </div>
          </div>

          {/* Hover border highlight */}
          <div
            className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.16)" }}
          />
        </div>
      </Link>
    );
  }

  // Landscape / backdrop card
  return (
    <Link href={href} className="block group">
      <div
        className="relative overflow-hidden rounded-2xl aspect-video transition-all duration-300 ease-out group-hover:scale-[1.03]"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        }}
      >
        {media.backdropUrl || media.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.backdropUrl || media.posterUrl || ""}
            alt={displayTitle}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
            loading="lazy"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
            }}
          >
            <span className="text-lg font-bold text-white/20 text-center px-4 leading-tight line-clamp-3">
              {displayTitle}
            </span>
          </div>
        )}

        {/* Cinematic gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)",
          }}
        />

        {/* Play button on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div
            className="h-11 w-11 rounded-full flex items-center justify-center shadow-xl"
            style={{
              background: "rgba(255,255,255,0.18)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.3)",
            }}
          >
            <Play className="h-5 w-5 fill-white text-white ml-0.5" />
          </div>
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span
              className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                media.mediaType === "anime"
                  ? "bg-purple-500/80 text-white"
                  : media.mediaType === "tv-show"
                  ? "bg-blue-500/80 text-white"
                  : "bg-brand-primary/80 text-white"
              }`}
            >
              {media.mediaType === "anime" ? "Anime" : media.mediaType === "tv-show" ? "TV" : "Movie"}
            </span>
          </div>
          <h4 className="text-white font-semibold text-sm leading-tight line-clamp-1 tracking-tight drop-shadow-md">
            {displayTitle}
          </h4>
        </div>

        {/* Hover border highlight */}
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.16)" }}
        />
      </div>
    </Link>
  );
}
