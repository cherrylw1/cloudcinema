import { PageContainer } from "@/components/layout/PageContainer";
import { SupabaseMediaRepository } from "@/repositories/media/supabase-media-repository";
import { PaginatedMediaGrid } from "@/components/media/PaginatedMediaGrid";
import { SearchBar } from "./SearchBar";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() || "";

  const repository = new SupabaseMediaRepository();
  const initialMedia = query
    ? await repository.getMediaList({ query, limit: 60 })
    : [];

  return (
    <PageContainer
      title="Search Results"
      description={query ? `Showing results matching "${query}"` : "Enter a search query to search the media library."}
    >
      <div className="space-y-6">
        <SearchBar initialQuery={query} />
        <PaginatedMediaGrid
          key={query}
          initialMedia={initialMedia}
          query={query}
          emptyStateMessage={query ? `No results for '${query}'.` : "Type a query in the search bar to look up movies or TV series."}
        />
      </div>
    </PageContainer>
  );
}
