import { PageContainer } from "@/components/layout/PageContainer";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageContainer
      title="TV Shows"
      description="Browse your personal series and television episodes."
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={`tv-shows-loading-skeleton-${i}`}
            className="aspect-video w-full animate-pulse rounded-xl border border-border/20 bg-card/10 p-4 flex flex-col justify-between"
          >
            <Skeleton className="h-4 w-12 rounded bg-foreground/10" />
            <div className="space-y-2 mt-4">
              <Skeleton className="h-3.5 w-3/4 rounded bg-foreground/10" />
              <Skeleton className="h-3 w-1/2 rounded bg-foreground/10" />
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
