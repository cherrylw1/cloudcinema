"use client";

import Link from "next/link";
import { Play, Info } from "lucide-react";
import type { Media } from "@/repositories/media";
import { useSelection } from "@/providers/SelectionProvider";
import { useRef, useState } from "react";
import { motion } from "framer-motion";

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

  const { isSelectionMode, selectedIds, toggleSelect } = useSelection();
  const isSelected = media.isGroup && media.episodeIds
    ? media.episodeIds.length > 0 && media.episodeIds.every(id => selectedIds.includes(id))
    : selectedIds.includes(media.id);

  // Bounding box coordinates tracking for 3D Tilt and Spotlight glow
  const cardRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = cardRef.current.getBoundingClientRect();
    
    // Convert cursor coords to ratios between -0.5 and 0.5
    const x = (clientX - left) / width - 0.5;
    const y = (clientY - top) / height - 0.5;
    setCoords({ x, y });
  };

  const handleToggle = () => {
    if (media.isGroup && media.episodeIds) {
      const allSelected = media.episodeIds.every(id => selectedIds.includes(id));
      for (const id of media.episodeIds) {
        const isSel = selectedIds.includes(id);
        if (allSelected) {
          if (isSel) toggleSelect(id);
        } else {
          if (!isSel) toggleSelect(id);
        }
      }
    } else {
      toggleSelect(media.id);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isSelectionMode) {
      e.preventDefault();
      e.stopPropagation();
      handleToggle();
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleToggle();
  };

  if (horizontal) {
    return (
      <Link href={href} onClick={handleClick} className="block group w-full cursor-pointer">
        {/* Outer container handles 3D tilt perspective */}
        <div style={{ perspective: 1000 }} className="w-full">
          <motion.div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => {
              setHovered(false);
              setCoords({ x: 0, y: 0 });
            }}
            animate={{
              rotateX: hovered ? -coords.y * 12 : 0,
              rotateY: hovered ? coords.x * 12 : 0,
              scale: hovered ? 1.02 : 1,
            }}
            transition={{ type: "spring", stiffness: 150, damping: 18 }}
            className="relative overflow-hidden rounded-2xl aspect-[2/3] transform-gpu transition-all duration-300"
            style={{
              background: isSelected ? "rgba(229,9,20,0.08)" : "rgba(255,255,255,0.04)",
              border: isSelected ? "1px solid rgba(229,9,20,0.5)" : "1px solid rgba(255,255,255,0.08)",
              boxShadow: isSelected 
                ? "0 0 0 2px rgba(229,9,20,0.25), 0 12px 32px rgba(0,0,0,0.5)" 
                : "0 8px 24px rgba(0,0,0,0.4)",
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

            {/* Inner Image (scales on hover) */}
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

            {/* Dynamic Spotlight Cursor Glow overlay */}
            {hovered && (
              <div 
                className="absolute inset-0 pointer-events-none z-20 mix-blend-screen transition-opacity duration-300"
                style={{
                  background: `radial-gradient(circle 120px at ${(coords.x + 0.5) * 100}% ${(coords.y + 0.5) * 100}%, rgba(255,255,255,0.08) 0%, transparent 100%)`
                }}
              />
            )}

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

            {/* Rotating Conic Prism Border Overlay on Hover */}
            <div
              className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.16)",
              }}
            />
            {hovered && (
              <div 
                className="absolute inset-0 rounded-2xl border border-white/20 pointer-events-none z-10"
                style={{
                  background: `conic-gradient(from 180deg, rgba(229,9,20,0.15) 0%, transparent 35%, rgba(99,102,241,0.15) 50%, transparent 85%, rgba(229,9,20,0.15) 100%)`,
                  maskImage: `linear-gradient(black, black) content-box, linear-gradient(black, black)`,
                  maskComposite: "exclude",
                  WebkitMaskComposite: "xor",
                }}
              />
            )}
          </motion.div>
        </div>
      </Link>
    );
  }

  // Landscape / backdrop card
  return (
    <Link href={href} onClick={handleClick} className="block group cursor-pointer">
      <div style={{ perspective: 1000 }} className="w-full">
        <motion.div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => {
            setHovered(false);
            setCoords({ x: 0, y: 0 });
          }}
          animate={{
            rotateX: hovered ? -coords.y * 12 : 0,
            rotateY: hovered ? coords.x * 12 : 0,
            scale: hovered ? 1.02 : 1,
          }}
          transition={{ type: "spring", stiffness: 150, damping: 18 }}
          className="relative overflow-hidden rounded-2xl aspect-video transform-gpu transition-all duration-300 ease-out"
          style={{
            background: isSelected ? "rgba(229,9,20,0.08)" : "rgba(255,255,255,0.04)",
            border: isSelected ? "1px solid rgba(229,9,20,0.5)" : "1px solid rgba(255,255,255,0.08)",
            boxShadow: isSelected 
              ? "0 0 0 2px rgba(229,9,20,0.25), 0 12px 32px rgba(0,0,0,0.5)" 
              : "0 8px 24px rgba(0,0,0,0.4)",
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

          {/* Background Image */}
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

          {/* Dynamic Spotlight Glow overlay */}
          {hovered && (
            <div 
              className="absolute inset-0 pointer-events-none z-20 mix-blend-screen transition-opacity duration-300"
              style={{
                background: `radial-gradient(circle 120px at ${(coords.x + 0.5) * 100}% ${(coords.y + 0.5) * 100}%, rgba(255,255,255,0.08) 0%, transparent 100%)`
              }}
            />
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

          {/* Rotating Conic Prism Border Overlay on Hover */}
          <div
            className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.16)",
            }}
          />
          {hovered && (
            <div 
              className="absolute inset-0 rounded-2xl border border-white/20 pointer-events-none z-10"
              style={{
                background: `conic-gradient(from 180deg, rgba(229,9,20,0.15) 0%, transparent 35%, rgba(99,102,241,0.15) 50%, transparent 85%, rgba(229,9,20,0.15) 100%)`,
                maskImage: `linear-gradient(black, black) content-box, linear-gradient(black, black)`,
                maskComposite: "exclude",
                WebkitMaskComposite: "xor",
              }}
            />
          )}
        </motion.div>
      </div>
    </Link>
  );
}
