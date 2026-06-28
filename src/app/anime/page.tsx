import { PageContainer } from "@/components/layout/PageContainer";
import { PaginatedMediaGrid } from "@/components/media/PaginatedMediaGrid";
import { SupabaseMediaRepository } from "@/repositories/media/supabase-media-repository";

export default async function AnimePage() {
  const repository = new SupabaseMediaRepository();
  const initialMedia = await repository.getMediaList({
    type: "anime",
    limit: 60,
    offset: 0,
  });

  return (
    <PageContainer
      title="Anime"
      description="Browse your indexed anime collections and series."
    >
      <PaginatedMediaGrid
        initialMedia={initialMedia}
        type="anime"
        emptyStateMessage="No anime collections indexed. Group your anime titles with metadata resolvers to view them here."
      />
    </PageContainer>
  );
}
