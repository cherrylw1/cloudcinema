import { PageContainer } from "@/components/layout/PageContainer";
import { PaginatedMediaGrid } from "@/components/media/PaginatedMediaGrid";
import { SupabaseMediaRepository } from "@/repositories/media/supabase-media-repository";

export default async function MissingMetadataPage() {
  const repository = new SupabaseMediaRepository();
  const initialMedia = await repository.getMediaList({
    metadataMissing: true,
    limit: 60,
    offset: 0,
  });

  return (
    <PageContainer
      title="Needs Metadata"
      description="Movies and TV files that do not have matched TMDB metadata yet."
    >
      <PaginatedMediaGrid
        initialMedia={initialMedia}
        metadataMissing
        emptyStateMessage="Every movie and TV file currently has metadata."
      />
    </PageContainer>
  );
}
