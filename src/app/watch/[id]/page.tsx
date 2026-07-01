import { PageContainer } from "@/components/layout/PageContainer";
import { SupabaseMediaRepository } from "@/repositories/media/supabase-media-repository";
import { SupabaseProgressRepository } from "@/repositories/progress/supabase-progress-repository";
import { VideoPlayer } from "@/components/media/VideoPlayer";
import { createClient } from "@/clients/supabase/server";
import { generateStreamToken } from "@/lib/token";
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

  // Fetch current user details to load existing playback progress
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  let initialProgress = null;
  let streamToken = "";
  let userId = "";

  if (user) {
    const progressRepository = new SupabaseProgressRepository();
    initialProgress = await progressRepository.getProgress(user.id, media.id);
    streamToken = generateStreamToken(media.id, user.id);
    userId = user.id;
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

        {/* Video Player Component */}
        <VideoPlayer 
          media={media} 
          initialProgress={initialProgress} 
          streamToken={streamToken}
          userId={userId}
        />
      </div>
    </PageContainer>
  );
}
