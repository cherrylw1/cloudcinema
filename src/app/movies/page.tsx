import { PageContainer } from "@/components/layout/PageContainer";
import { PaginatedMediaGrid } from "@/components/media/PaginatedMediaGrid";
import { SupabaseMediaRepository } from "@/repositories/media/supabase-media-repository";

export default async function MoviesPage() {
  const repository = new SupabaseMediaRepository();
  const initialMedia = await repository.getMediaList({
    type: "movie",
    limit: 60,
    offset: 0,
  });

  return (
    <PageContainer
      title="Movies"
      description="Browse your personal collection of motion pictures."
    >
      <PaginatedMediaGrid
        initialMedia={initialMedia}
        type="movie"
        emptyStateMessage="No movies indexed. Add video files to your linked source folders to watch them here."
      />
    </PageContainer>
  );
}
