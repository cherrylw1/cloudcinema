import { PageContainer } from "@/components/layout/PageContainer";
import { SupabaseMediaRepository } from "@/repositories/media/supabase-media-repository";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repository = new SupabaseMediaRepository();
  const media = await repository.getMediaById(id);

  if (!media) {
    notFound();
  }

  const isTv = media.mediaType === "tv-show";
  const sectionTitle = isTv && media.series ? media.series : media.title;
  const sectionDesc = isTv 
    ? `Season ${media.season} • Episode ${media.episode} (${media.title})` 
    : "Now Playing Movie";

  return (
    <PageContainer
      title={sectionTitle}
      description={sectionDesc}
    >
      <div className="space-y-4">
        {/* Navigation Return Hook */}
        <div className="flex items-center">
          <Link
            href={isTv ? "/tv-shows" : "/movies"}
            className="flex items-center gap-2 text-xs font-semibold text-foreground/60 hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Catalog
          </Link>
        </div>

        {/* Video Player Display */}
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-border/40 shadow-2xl">
          <video
            controls
            autoPlay
            src={`/api/stream/${media.id}`}
            className="w-full h-full object-contain"
          >
            Your browser does not support HTML5 video streaming.
          </video>
        </div>
      </div>
    </PageContainer>
  );
}
