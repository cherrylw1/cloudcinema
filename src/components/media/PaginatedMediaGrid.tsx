"use client";

import { useState } from "react";
import Link from "next/link";
import type { Media } from "@/repositories/media";
import { getMediaListAction } from "@/server/actions/media-actions";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, RefreshCw } from "lucide-react";

interface PaginatedMediaGridProps {
  initialMedia: Media[];
  type: "movie" | "tv-show" | "anime";
  emptyStateMessage: string;
}

export function PaginatedMediaGrid({ initialMedia, type, emptyStateMessage }: PaginatedMediaGridProps) {
  const [mediaList, setMediaList] = useState<Media[]>(initialMedia);
  const [offset, setOffset] = useState(initialMedia.length);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialMedia.length === 60);

  const handleLoadMore = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const nextLimit = 60;
      const newItems = await getMediaListAction({
        type,
        limit: nextLimit,
        offset,
      });

      if (newItems.length > 0) {
        setMediaList((prev) => [...prev, ...newItems]);
        setOffset((prev) => prev + newItems.length);
      }
      
      if (newItems.length < nextLimit) {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Failed to load more media:", err);
    } finally {
      setLoading(false);
    }
  };

  if (mediaList.length === 0) {
    return (
      <div className="glass rounded-2xl p-6 border border-border/40 bg-card/10">
        <p className="text-sm text-foreground/75 leading-relaxed">
          {emptyStateMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Grid Layout */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {mediaList.map((media) => (
          <Link href={`/watch/${media.id}`} key={media.id} className="block group">
            <GlassCard
              className="relative overflow-hidden flex flex-col justify-between aspect-video rounded-xl p-0 bg-card/10 hover:bg-card/25 border border-border/40 transition-all duration-300 cursor-pointer"
            >
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

              {/* Play icon overlay on hover */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-xl z-20">
                <div className="h-10 w-10 rounded-full bg-brand-primary text-white flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-300 shadow-lg">
                  <Play className="h-5 w-5 fill-white ml-0.5" />
                </div>
              </div>

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
        ))}

        {/* Load More Skeleton Cards */}
        {loading && Array.from({ length: 5 }).map((_, i) => (
          <div key={`load-more-skeleton-${i}`} className="aspect-video w-full animate-pulse rounded-xl border border-border/20 bg-card/5 p-4 flex flex-col justify-between">
            <Skeleton className="h-4 w-12 rounded bg-foreground/10" />
            <div className="space-y-2 mt-4">
              <Skeleton className="h-3.5 w-3/4 rounded bg-foreground/10" />
              <Skeleton className="h-3 w-1/2 rounded bg-foreground/10" />
            </div>
          </div>
        ))}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            onClick={handleLoadMore}
            disabled={loading}
            className="flex items-center gap-2 h-10 px-6 border border-border/50 bg-card/20 hover:bg-card/40 text-foreground rounded-xl transition-all duration-200 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  );
}
