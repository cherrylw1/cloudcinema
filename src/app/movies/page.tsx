import { PageContainer } from "@/components/layout/PageContainer";
import { MediaLoadError } from "@/components/media/MediaLoadError";
import { PaginatedMediaGrid } from "@/components/media/PaginatedMediaGrid";
import { SupabaseMediaRepository } from "@/repositories/media/supabase-media-repository";
import type { Media } from "@/repositories/media";

export default async function MoviesPage() {
  const repository = new SupabaseMediaRepository();
  let initialMedia: Media[] = [];
  let loadError = false;

  try {
    initialMedia = await repository.getMediaList({
      type: "movie",
      limit: 60,
      offset: 0,
    });
  } catch (error) {
    console.error("[Movies] Failed to load media catalog:", error);
    loadError = true;
  }

  return (
    <PageContainer
      title="Movies"
      description="Browse your personal collection of motion pictures."
    >
      {loadError ? (
        <MediaLoadError href="/movies" />
      ) : (
        <PaginatedMediaGrid
          initialMedia={initialMedia}
          type="movie"
          emptyStateMessage="No movies indexed. Add video files to your linked source folders to watch them here."
        />
      )}
    </PageContainer>
  );
}
