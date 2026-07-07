"use client";

import Link from "next/link";
import { Play, Info } from "lucide-react";
import type { Media } from "@/repositories/media";
import { motion } from "framer-motion";
import { Magnetic } from "@/components/ui/Magnetic";

interface CinematicHeroProps {
  media: Media;
  title: string | null;
  href: string;
}

export function CinematicHero({ media, title, href }: CinematicHeroProps) {
  return (
    <div className="relative w-full overflow-hidden" style={{ height: "85vh", minHeight: "500px" }}>
      {/* 1. Backdrop Image with slow scale-in transition and mouse parallax depth */}
      <div className="absolute inset-0 z-0 select-none pointer-events-none transform-gpu overflow-hidden">
        {media.backdropUrl ? (
          <motion.img
            src={media.backdropUrl}
            alt={title || ""}
            initial={{ scale: 1.08, opacity: 0 }}
            animate={{ scale: 1.01, opacity: 1 }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black" />
        )}
      </div>

      {/* Cinematic Gradient layers */}
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-black via-black/55 to-transparent pointer-events-none" />
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black via-transparent to-black/20 pointer-events-none" />

      {/* 2. Soft color bleed glow reflecting key genres behind the text container */}
      <div 
        className="absolute bottom-1/4 left-10 z-0 w-72 h-72 rounded-full opacity-20 filter blur-[90px] pointer-events-none"
        style={{
          background: media.mediaType === "anime" 
            ? "#a855f7" 
            : media.mediaType === "tv-show" 
            ? "#3b82f6" 
            : "#e50914"
        }}
      />

      {/* 3. Hero content with staggered spring fade-in entrances */}
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.12,
              delayChildren: 0.2,
            }
          }
        }}
        className="absolute bottom-0 left-0 right-0 px-8 md:px-16 pb-24 md:pb-32 z-20 max-w-3xl"
      >
        <div className="space-y-4">
          {/* Badge */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 15 },
              visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
            }}
          >
            <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded border ${
              media.mediaType === "anime"
                ? "bg-purple-500/80 border-purple-400/20 text-white"
                : media.mediaType === "tv-show"
                ? "bg-blue-500/80 border-blue-400/20 text-white"
                : "bg-brand-primary/80 border-red-400/20 text-white"
            }`}>
              {media.mediaType === "anime" ? "Anime" : media.mediaType === "tv-show" ? "TV Show" : "Movie"}
            </span>
          </motion.div>

          {/* Title */}
          <motion.h1
            variants={{
              hidden: { opacity: 0, y: 25 },
              visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 85, damping: 15 } }
            }}
            className="text-3xl sm:text-4xl md:text-6xl font-black text-white leading-tight drop-shadow-2xl break-all"
          >
            {title}
          </motion.h1>

          {/* Overview */}
          {media.overview && (
            <motion.p
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 90, damping: 18 } }
              }}
              className="text-sm md:text-base text-white/80 leading-relaxed max-w-xl line-clamp-3"
            >
              {media.overview}
            </motion.p>
          )}

          {/* Buttons wrapped in Magnetic fields */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 15 },
              visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
            }}
            className="flex items-center gap-2.5 pt-1.5"
          >
            <Magnetic range={65} strength={0.25}>
              <Link
                href={`/watch/${media.id}`}
                className="flex items-center gap-2 px-5 py-2.5 md:px-8 md:py-3 bg-white text-black rounded-lg font-bold text-sm md:text-base hover:bg-white/90 transition-all shadow-xl cursor-pointer"
              >
                <Play className="h-4.5 w-4.5 fill-black" />
                Play
              </Link>
            </Magnetic>

            <Magnetic range={65} strength={0.25}>
              <Link
                href={href}
                className="flex items-center gap-2 px-4 py-2.5 md:px-6 md:py-3 bg-white/15 backdrop-blur-md text-white rounded-lg font-semibold text-sm md:text-base hover:bg-white/25 border border-white/20 transition-all cursor-pointer"
              >
                <Info className="h-4.5 w-4.5" />
                More Info
              </Link>
            </Magnetic>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
