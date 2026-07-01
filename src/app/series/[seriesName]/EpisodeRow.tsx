"use client";

import Link from "next/link";
import { Play, Clock, HardDrive } from "lucide-react";
import { useSelection } from "@/providers/SelectionProvider";
import type { Media } from "@/repositories/media";

interface EpisodeRowProps {
  ep: Media;
  progressPct: number;
  completed: boolean;
  runtimeStr: string;
  fileSizeStr: string;
}

export function EpisodeRow({
  ep,
  progressPct,
  completed,
  runtimeStr,
  fileSizeStr,
}: EpisodeRowProps) {
  const { isSelectionMode, selectedIds, toggleSelect } = useSelection();
  const isSelected = selectedIds.includes(ep.id);

  const handleClick = (e: React.MouseEvent) => {
    if (isSelectionMode) {
      e.preventDefault();
      e.stopPropagation();
      toggleSelect(ep.id);
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSelect(ep.id);
  };

  return (
    <Link
      href={`/watch/${ep.id}`}
      onClick={handleClick}
      className={`flex items-center gap-4 p-4 rounded-xl border hover:bg-white/10 transition-all group relative select-none ${
        isSelected 
          ? "bg-brand-primary/5 border-brand-primary/80" 
          : "bg-white/5 border-white/10"
      }`}
    >
      {/* Checkbox for selection */}
      <div 
        onClick={handleCheckboxClick}
        className={`mr-1 flex-shrink-0 transition-opacity duration-200 ${
          isSelectionMode ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <div className={`h-4.5 w-4.5 rounded border flex items-center justify-center transition-colors cursor-pointer ${
          isSelected 
            ? "bg-brand-primary border-brand-primary text-white" 
            : "bg-black/60 border-white/30 text-transparent hover:border-white/60"
        }`}>
          <svg className="h-3 w-3 fill-none stroke-current stroke-[2.5]" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>

      {/* Episode thumbnail / number */}
      <div className="relative flex-shrink-0">
        {ep.backdropUrl || ep.posterUrl ? (
          <div className="relative w-28 aspect-video rounded-lg overflow-hidden border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ep.backdropUrl || ep.posterUrl || ""}
              alt={ep.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {progressPct > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
                <div className="h-full bg-brand-primary" style={{ width: `${progressPct}%` }} />
              </div>
            )}
            {!isSelectionMode && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Play className="h-5 w-5 fill-white text-white" />
              </div>
            )}
          </div>
        ) : (
          <div className="w-28 aspect-video rounded-lg bg-white/10 flex items-center justify-center text-white/30 font-bold text-xl border border-white/5">
            {ep.episode ?? "?"}
          </div>
        )}
      </div>

      {/* Episode info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {ep.episode != null && (
            <span className="text-xs text-white/40 font-mono">
              {ep.season != null ? `S${String(ep.season).padStart(2, "0")}` : ""}E{String(ep.episode).padStart(2, "0")}
            </span>
          )}
          {completed && (
            <span className="text-[10px] text-green-400 bg-green-400/10 border border-green-400/20 px-1.5 py-0.5 rounded font-medium">Watched</span>
          )}
        </div>
        <p className="text-white font-medium text-sm line-clamp-1">{ep.title}</p>
        <div className="flex items-center gap-3 mt-1">
          {runtimeStr && (
            <span className="text-white/40 text-xs flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {runtimeStr}
            </span>
          )}
          {fileSizeStr && (
            <span className="text-white/40 text-xs flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              {fileSizeStr}
            </span>
          )}
        </div>
      </div>

      {/* Play button */}
      {!isSelectionMode && (
        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="h-9 w-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
            <Play className="h-4 w-4 fill-white text-white ml-0.5" />
          </div>
        </div>
      )}
    </Link>
  );
}
