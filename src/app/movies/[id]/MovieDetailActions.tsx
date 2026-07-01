"use client";

import { useState } from "react";
import { Play, Plus, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/clients/supabase/browser";
import { useRouter } from "next/navigation";
import { EditMetadataButton } from "@/components/media/EditMetadataButton";

interface MovieDetailActionsProps {
  mediaId: string;
  initialInWatchlist: boolean;
  userId: string | null;
}

export function MovieDetailActions({
  mediaId,
  initialInWatchlist,
  userId,
}: MovieDetailActionsProps) {
  const [inWatchlist, setInWatchlist] = useState(initialInWatchlist);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleWatchlistToggle = async () => {
    if (!userId) {
      router.push("/login");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    try {
      if (inWatchlist) {
        // Remove from watchlist
        const { error } = await supabase
          .from("watchlist")
          .delete()
          .eq("user_id", userId)
          .eq("media_id", mediaId);
        if (error) throw error;
        setInWatchlist(false);
      } else {
        // Add to watchlist
        const { error } = await supabase
          .from("watchlist")
          .insert({ user_id: userId, media_id: mediaId });
        if (error) throw error;
        setInWatchlist(true);
      }
      router.refresh();
    } catch (err) {
      console.error("Error toggling watchlist:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 pt-2">
      {/* Play Movie Button */}
      <Link
        href={`/watch/${mediaId}`}
        className="flex items-center gap-2 px-8 py-3.5 bg-brand-primary hover:bg-brand-primary/95 text-white rounded-xl font-bold text-base transition-all shadow-lg shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
      >
        <Play className="h-5 w-5 fill-white" />
        Play Movie
      </Link>

      {/* Watchlist Button */}
      <button
        onClick={handleWatchlistToggle}
        disabled={loading}
        className={`flex items-center gap-2 px-6 py-3.5 border rounded-xl font-semibold text-base transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
          inWatchlist
            ? "bg-white/10 border-white/20 text-white hover:bg-white/15"
            : "bg-white/5 border-white/10 text-white/95 hover:bg-white/10 hover:text-white"
        }`}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : inWatchlist ? (
          <Check className="h-5 w-5 text-green-500 fill-green-500/20" />
        ) : (
          <Plus className="h-5 w-5" />
        )}
        Watchlist
      </button>

      {/* Edit Metadata Button */}
      <EditMetadataButton
        mediaId={mediaId}
        defaultType="movie"
        className="flex items-center gap-2 px-6 py-3.5 border border-white/10 bg-white/5 text-white/95 hover:bg-white/10 hover:text-white rounded-xl font-semibold text-base transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
      />
    </div>
  );
}
