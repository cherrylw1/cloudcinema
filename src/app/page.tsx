import { PageContainer } from "@/components/layout/PageContainer";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { createClient } from "@/clients/supabase/server";
import { MediaCard } from "@/components/media/MediaCard";
import type { Media } from "@/repositories/media";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let continueWatchingItems: Media[] = [];

  if (user) {
    const { data, error } = await supabase
      .from("user_progress")
      .select(`
        playback_position,
        last_watched,
        completed,
        media_library:media_id (
          id,
          title,
          series,
          season,
          episode,
          media_type,
          poster_url,
          backdrop_url,
          runtime,
          file_size,
          created_at,
          updated_at
        )
      `)
      .eq("profile_id", user.id)
      .eq("completed", false)
      .gt("playback_position", 0)
      .order("last_watched", { ascending: false })
      .limit(10);

    if (!error && data) {
      continueWatchingItems = data
        .map((item) => {
          const mediaArray = item.media_library;
          const media = Array.isArray(mediaArray) ? mediaArray[0] : mediaArray;
          if (!media) return null;
          return {
            id: media.id,
            driveFileId: "",
            title: media.title,
            series: media.series,
            season: media.season,
            episode: media.episode,
            mediaType: media.media_type,
            posterUrl: media.poster_url,
            backdropUrl: media.backdrop_url,
            runtime: media.runtime,
            fileSize: media.file_size,
            createdAt: media.created_at,
            updatedAt: media.updated_at,
          } as Media;
        })
        .filter((item): item is Media => item !== null);
    }
  }

  return (
    <PageContainer
      title="Home"
      description="Welcome to CloudCinema. This is your main dashboard."
    >
      <div className="space-y-8">
        {continueWatchingItems.length > 0 ? (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground tracking-tight">
              Continue Watching
            </h3>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {continueWatchingItems.map((media) => (
                <MediaCard key={`continue-${media.id}`} media={media} />
              ))}
            </div>
          </div>
        ) : (
          <GlassPanel>
            <p className="text-sm text-foreground/75 leading-relaxed">
              The home feed is currently empty. Media content and dashboard feeds will appear here in future updates.
            </p>
          </GlassPanel>
        )}
      </div>
    </PageContainer>
  );
}
