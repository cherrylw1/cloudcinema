import { PageContainer } from "@/components/layout/PageContainer";
import { createClient } from "@/clients/supabase/server";
import { SeriesCard } from "@/components/media/SeriesCard";
import type { Media } from "@/repositories/media";
import type { Database } from "@/types/database";
import { redirect } from "next/navigation";

type MediaRow_DB = Database["public"]["Tables"]["media_library"]["Row"];

function dbRowToMedia(row: MediaRow_DB): Media {
  return {
    id: row.id,
    driveFileId: row.drive_file_id,
    title: row.title,
    series: row.series,
    season: row.season,
    episode: row.episode,
    mediaType: row.media_type,
    overview: row.overview,
    posterUrl: row.poster_url,
    backdropUrl: row.backdrop_url,
    runtime: row.runtime,
    fileSize: row.file_size,
    tmdbId: row.tmdb_id,
    mimeType: row.mime_type,
    dvProfile: row.dv_profile,
    audioCodec: row.audio_codec,
    audioStreams: null,
    subtitleStreams: null,
    processingStatus: row.processing_status,
    audioVariants: null,
    subtitleTracks: null,
    processedDriveFileId: row.processed_drive_file_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async function WatchlistPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("watchlist")
    .select(`
      id,
      user_id,
      media_id,
      created_at,
      media_library:media_id (*)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching watchlist:", error);
  }

  const watchlistItems = (data || [])
    .map((item) => {
      const mediaArr = item.media_library;
      const m = Array.isArray(mediaArr) ? mediaArr[0] : mediaArr;
      return m ? dbRowToMedia(m as MediaRow_DB) : null;
    })
    .filter((m): m is Media => m !== null);

  // Group TV shows / anime by series name (deduplicate cards using seen Set as done on TV page)
  const seen = new Set<string>();
  const dedupedItems = watchlistItems.filter((item) => {
    if (item.mediaType === "movie") return true;
    const key = item.series || item.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <PageContainer
      title="My Watchlist"
      description="Keep track of the movies and series you want to watch."
    >
      {dedupedItems.length === 0 ? (
        <div className="glass rounded-2xl p-6 border border-border/40 bg-card/10">
          <p className="text-sm text-foreground/75 leading-relaxed">
            Your watchlist is empty. Add movies or TV shows to your watchlist to keep track of them here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {dedupedItems.map((item) => (
            <SeriesCard key={item.id} media={item} horizontal={true} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
