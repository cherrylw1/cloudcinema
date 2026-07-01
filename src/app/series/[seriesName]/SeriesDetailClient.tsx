"use client";

import { useState } from "react";
import { Plus, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { EditMetadataButton } from "@/components/media/EditMetadataButton";

interface SeriesDetailClientProps {
  seriesName: string;
  defaultType: "movie" | "tv";
  mediaId: string;
  initialInWatchlist: boolean;
  userId: string | null;
}

export function SeriesDetailClient({
  seriesName,
  defaultType,
  mediaId,
  initialInWatchlist,
  userId,
}: SeriesDetailClientProps) {
  const [inWatchlist, setInWatchlist] = useState(initialInWatchlist);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleWatchlistToggle = async () => {
    if (!userId) {
      router.push("/login");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mediaId }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to toggle watchlist");
      }
      const data = await res.json();
      setInWatchlist(data.status === "added");
      router.refresh();
    } catch (err) {
      console.error("Error toggling watchlist:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Watchlist Toggle Button */}
      <button
        onClick={handleWatchlistToggle}
        disabled={loading}
        className={`flex items-center gap-2 px-5 py-2.5 border rounded-lg font-semibold text-sm transition-all cursor-pointer hover:bg-white/10 ${
          inWatchlist
            ? "bg-white/15 border-white/20 text-white"
            : "bg-white/5 border-white/10 text-white/90 hover:text-white"
        }`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : inWatchlist ? (
          <Check className="h-4 w-4 text-green-500 fill-green-500/20" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Watchlist
      </button>

      {/* Edit Metadata Button */}
      <EditMetadataButton
        seriesName={seriesName}
        defaultType={defaultType}
        className="flex items-center gap-2 px-5 py-2.5 border border-white/10 bg-white/5 text-white/90 hover:text-white hover:bg-white/10 rounded-lg font-semibold text-sm transition-all cursor-pointer"
      />
    </div>
  );
}
