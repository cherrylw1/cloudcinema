"use client";

import { useState } from "react";
import type { Media } from "@/repositories/media";
import { getMediaListAction } from "@/server/actions/media-actions";
import { MediaCard } from "@/components/media/MediaCard";
import { SeriesCard } from "@/components/media/SeriesCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw } from "lucide-react";

interface PaginatedMediaGridProps {
  initialMedia: Media[];
  type?: "movie" | "tv-show" | "anime";
  query?: string;
  emptyStateMessage: string;
}

export function PaginatedMediaGrid({ initialMedia, type, query, emptyStateMessage }: PaginatedMediaGridProps) {
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
        query,
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
      <div className={
        type === "movie"
          ? "grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3 sm:gap-5"
          : "grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 sm:gap-5"
      }>
        {mediaList.map((media) =>
          type === "movie" ? (
            <SeriesCard key={media.id} media={media} horizontal={true} />
          ) : (
            <MediaCard key={media.id} media={media} />
          )
        )}

        {/* Load More Skeleton Cards */}
        {loading && Array.from({ length: 5 }).map((_, i) => (
          <div key={`load-more-skeleton-${i}`} className={`${type === "movie" ? "aspect-[2/3]" : "aspect-video"} w-full animate-pulse rounded-xl border border-border/20 bg-card/5 p-4 flex flex-col justify-between`}>
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
