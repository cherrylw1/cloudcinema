import { PageContainer } from "@/components/layout/PageContainer";
import { createClient } from "@/clients/supabase/server";
import { GroupingClient } from "./GroupingClient";
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

export default async function GroupPage() {
  const supabase = await createClient();

  // Fetch all media files to display in the editor
  const { data } = await supabase
    .from("media_library")
    .select("*")
    .order("title", { ascending: true });

  const mediaList = (data || []).map(dbRowToMedia);

  return (
    <PageContainer
      title="Group Files into TV Series"
      description="Select multiple files and group them into a single TV Show/Anime series folder."
    >
      <GroupingClient initialMedia={mediaList} />
    </PageContainer>
  );
}
