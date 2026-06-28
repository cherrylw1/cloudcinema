import { PageContainer } from "@/components/layout/PageContainer";
import { PaginatedMediaGrid } from "@/components/media/PaginatedMediaGrid";
import { SupabaseMediaRepository } from "@/repositories/media/supabase-media-repository";

export default async function TVShowsPage() {
  const repository = new SupabaseMediaRepository();
  const initialMedia = await repository.getMediaList({
    type: "tv-show",
    limit: 60,
    offset: 0,
  });

  return (
    <PageContainer
      title="TV Shows"
      description="Browse your personal series and television episodes."
    >
      <PaginatedMediaGrid
        initialMedia={initialMedia}
        type="tv-show"
        emptyStateMessage="No TV shows indexed. Organize your media folders by series name to watch episodes here."
      />
    </PageContainer>
  );
}
