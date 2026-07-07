import { PageContainer } from "@/components/layout/PageContainer";
import { SupabaseMediaRepository } from "@/repositories/media/supabase-media-repository";
import { SearchContainer } from "./SearchContainer";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() || "";

  const repository = new SupabaseMediaRepository();
  
  // 1. Fetch initial keyword matches
  const initialMedia = query
    ? await repository.getMediaList({ query, limit: 60 })
    : [];

  return (
    <PageContainer
      title="Search Catalog"
      description={query ? `Results matching "${query}"` : "Search your drive media using keywords or conversational AI."}
    >
      <SearchContainer
        initialMedia={initialMedia}
        query={query}
      />
    </PageContainer>
  );
}
