import { PageContainer } from "@/components/layout/PageContainer";
import { createClient } from "@/clients/supabase/server";
import { SeriesCard } from "@/components/media/SeriesCard";
import type { Media } from "@/repositories/media";
import type { Database } from "@/types/database";

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
    dvProfile: null,
    audioCodec: null,
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

export default async function TVShowsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("media_library")
    .select("*")
    .eq("media_type", "tv-show")
    .order("series", { ascending: true });

  const allEpisodes = (data || []).map(dbRowToMedia);

  // Deduplicate: one card per series
  const seen = new Set<string>();
  const series = allEpisodes.filter((item) => {
    const key = item.series || item.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <PageContainer
      title="TV Shows"
      description="Browse your personal series and television episodes."
    >
      {series.length === 0 ? (
        <div className="glass rounded-2xl p-6 border border-border/40 bg-card/10">
          <p className="text-sm text-foreground/75 leading-relaxed">
            No TV shows indexed. Organize your media folders by series name to watch episodes here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {series.map((show) => (
            <SeriesCard key={show.id} media={show} horizontal={true} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
