"use client";

import Link from "next/link";
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

  const href = media.mediaType === "movie" ? `/movies/${media.id}` : `/watch/${media.id}`;

  return (
    <Link href={href} onClick={handleClick} className="block group relative">
      <div
        className="relative overflow-hidden flex flex-col justify-between aspect-video rounded-2xl transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] cursor-pointer h-full group-hover:scale-[1.02]"
        style={{
          background: isSelected
            ? "rgba(229,9,20,0.08)"
            : "rgba(255,255,255,0.04)",
          border: isSelected
            ? "1px solid rgba(229,9,20,0.5)"
            : "1px solid rgba(255,255,255,0.08)",
          boxShadow: isSelected
            ? "0 0 0 2px rgba(229,9,20,0.25), 0 4px 24px rgba(0,0,0,0.4)"
            : "0 4px 24px rgba(0,0,0,0.4)",
        }}
      >
        {/* Selection Checkbox */}
        <div
          onClick={handleCheckboxClick}
          className={`absolute top-2.5 left-2.5 z-30 transition-all duration-200 ${
            isSelectionMode ? "opacity-100 scale-100" : "opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100"
          }`}
        >
          <div
            className="h-5 w-5 rounded-md flex items-center justify-center transition-all duration-200 cursor-pointer"
            style={{
              background: isSelected ? "rgba(229,9,20,1)" : "rgba(0,0,0,0.65)",
              border: isSelected ? "1px solid rgba(229,9,20,0.8)" : "1px solid rgba(255,255,255,0.25)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            {isSelected && (
              <svg className="h-3 w-3 fill-none stroke-white stroke-[2.5]" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>

        {/* Poster Image */}
        {media.posterUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={media.posterUrl}
              alt={media.title}
              className="absolute inset-0 w-full h-full object-cover rounded-2xl transition-transform duration-500 group-hover:scale-[1.05]"
              loading="lazy"
            />
            <div
              className="absolute inset-0 rounded-2xl"
              style={{
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.0) 100%)",
              }}
            />
          </>
        )}

        {/* Play overlay on hover */}
        {!isSelectionMode && (
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-250 flex items-center justify-center rounded-2xl z-20"
            style={{ background: "rgba(0,0,0,0.35)" }}
          >
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-300 shadow-xl"
              style={{
                background: "rgba(255,255,255,0.92)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
              }}
            >
              <Play className="h-4 w-4 fill-black text-black ml-0.5" />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex flex-col h-full justify-between p-3.5 z-10 relative">
          <div className="flex justify-between items-start gap-2">
            <span
              className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full"
              style={{
                background: media.posterUrl ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: media.posterUrl ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.6)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            >
              {media.mediaType === "tv-show" ? "Episode" : media.mediaType === "anime" ? "Anime" : "Movie"}
            </span>

            {media.mediaType === "tv-show" && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full font-mono"
                style={{
                  background: "rgba(229,9,20,0.85)",
                  color: "white",
                }}
              >
                S{String(media.season ?? 0).padStart(2, "0")}E{String(media.episode ?? 0).padStart(2, "0")}
              </span>
            )}
          </div>

          <div className="mt-auto space-y-0.5">
            <h4
              className={`font-semibold leading-snug line-clamp-2 text-xs md:text-sm tracking-[-0.01em] ${
                media.posterUrl ? "text-white drop-shadow-md" : "text-white/80"
              }`}
            >
              {media.mediaType === "tv-show" && media.series ? media.series : media.title}
            </h4>
            {media.mediaType === "tv-show" && media.title && (
              <p
                className={`text-[10px] truncate font-normal ${
                  media.posterUrl ? "text-white/55" : "text-white/35"
                }`}
              >
                {media.title}
              </p>
            )}
            {media.fileSize && (
              <p
                className={`text-[9px] font-mono ${
                  media.posterUrl ? "text-white/40" : "text-white/25"
                }`}
              >
                {(media.fileSize / 1073741824).toFixed(1)} GB
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
