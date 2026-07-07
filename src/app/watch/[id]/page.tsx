import { PageContainer } from "@/components/layout/PageContainer";
import { SupabaseMediaRepository } from "@/repositories/media/supabase-media-repository";
import { SupabaseProgressRepository } from "@/repositories/progress/supabase-progress-repository";
import { VideoPlayer } from "@/components/media/VideoPlayer";
import { createClient } from "@/clients/supabase/server";
import { createAdminClient } from "@/clients/supabase/admin";
import { generateStreamToken } from "@/lib/token";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EditMetadataButton } from "@/components/media/EditMetadataButton";
import type { Media } from "@/repositories/media";

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

    // Touch the progress record to update last_watched timestamp immediately on page load
    await progressRepository.saveProgress({
      profileId: user.id,
      mediaId: media.id,
      playbackPosition: initialProgress ? initialProgress.playbackPosition : 0,
      completed: initialProgress ? initialProgress.completed : false,
    });

    if (!initialProgress) {
      initialProgress = await progressRepository.getProgress(user.id, media.id);
    }

    streamToken = generateStreamToken(media.id, user.id);
    userId = user.id;
  }

  const isTv = media.mediaType === "tv-show" || media.mediaType === "anime";
  const sectionTitle = isTv && media.series ? media.series : media.title;
  const sectionDesc = isTv 
    ? `Season ${media.season} • Episode ${media.episode} (${media.title})` 
    : "Now Playing Movie";

  // ── Next Episode Lookup (TV shows / anime only) ──────────────────────────
  let nextEpisode: Media | null = null;
  if (isTv && media.series && media.season != null && media.episode != null) {
    const adminSupabase = createAdminClient();

    // 1. Try same season, episode + 1
    const { data: sameSeasonNext } = await adminSupabase
      .from("media_library")
      .select("id, title, series, season, episode, media_type, poster_url, drive_file_id")
      .eq("series", media.series)
      .eq("season", media.season)
      .eq("episode", (media.episode || 0) + 1)
      .maybeSingle();

    if (sameSeasonNext) {
      nextEpisode = {
        id: sameSeasonNext.id,
        driveFileId: sameSeasonNext.drive_file_id,
        title: sameSeasonNext.title || "",
        series: sameSeasonNext.series,
        season: sameSeasonNext.season,
        episode: sameSeasonNext.episode,
        mediaType: sameSeasonNext.media_type as Media["mediaType"],
        posterUrl: sameSeasonNext.poster_url,
        audioVariants: [],
        subtitleTracks: [],
        processingStatus: "",
        createdAt: "",
        updatedAt: "",
      };
    } else {
      // 2. Fallback: next season, episode 1
      const { data: nextSeasonEp1 } = await adminSupabase
        .from("media_library")
        .select("id, title, series, season, episode, media_type, poster_url, drive_file_id")
        .eq("series", media.series)
        .eq("season", (media.season || 0) + 1)
        .eq("episode", 1)
        .maybeSingle();

      if (nextSeasonEp1) {
        nextEpisode = {
          id: nextSeasonEp1.id,
          driveFileId: nextSeasonEp1.drive_file_id,
          title: nextSeasonEp1.title || "",
          series: nextSeasonEp1.series,
          season: nextSeasonEp1.season,
          episode: nextSeasonEp1.episode,
          mediaType: nextSeasonEp1.media_type as Media["mediaType"],
          posterUrl: nextSeasonEp1.poster_url,
          audioVariants: [],
          subtitleTracks: [],
          processingStatus: "",
          createdAt: "",
          updatedAt: "",
        };
      }
    }
  }

  return (
    <PageContainer title={sectionTitle} description={sectionDesc}>
      <div className="space-y-4">
        {/* Navigation Return Hook */}
        <div className="flex items-center justify-between">
          <Link
            href={isTv ? "/tv-shows" : "/movies"}
            className="flex items-center gap-2 text-xs font-semibold text-foreground/60 hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Catalog
          </Link>
          <EditMetadataButton
            mediaId={media.id}
            seriesName={media.series || undefined}
            defaultType={media.mediaType === "movie" ? "movie" : "tv"}
          />
        </div>

        {/* Video Player Component */}
        <VideoPlayer 
          media={media} 
          initialProgress={initialProgress} 
          streamToken={streamToken}
          userId={userId}
          nextEpisode={nextEpisode}
        />
      </div>
    </PageContainer>
  );
}
