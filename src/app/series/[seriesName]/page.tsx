import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/clients/supabase/server";
import { Play, ChevronLeft } from "lucide-react";
import { SeriesDetailClient } from "./SeriesDetailClient";
import { EpisodeRow } from "./EpisodeRow";

interface SeriesPageProps {
  params: Promise<{ seriesName: string }>;
}

function formatRuntime(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  const gb = bytes / (1024 ** 3);
  return `${gb.toFixed(2)} GB`;
}

export default async function SeriesPage({ params }: SeriesPageProps) {
  const { seriesName } = await params;
  const decoded = decodeURIComponent(seriesName);

  const supabase = await createClient();

  // Fetch all episodes for this series
  const { data: episodes, error } = await supabase
    .from("media_library")
    .select("*")
    .or(`series.eq."${decoded}",title.eq."${decoded}"`)
    .order("season", { ascending: true })
    .order("episode", { ascending: true });

  if (error || !episodes || episodes.length === 0) {
    notFound();
  }

  // Use first episode for show-level metadata
  const showMeta = episodes[0];
  const backdropUrl = showMeta.backdrop_url;
  const posterUrl = showMeta.poster_url;
  const overview = showMeta.overview;
  const displayTitle = showMeta.series || showMeta.title;

  // Group by season
  const seasonMap: Record<number, typeof episodes> = {};
  for (const ep of episodes) {
    const s = ep.season ?? 1;
    if (!seasonMap[s]) seasonMap[s] = [];
    seasonMap[s].push(ep);
  }
  const seasons = Object.keys(seasonMap).map(Number).sort((a, b) => a - b);

  // Fetch watch progress for user
  const { data: { user } } = await supabase.auth.getUser();
  const progressMap: Record<string, { position: number; completed: boolean }> = {};
  if (user) {
    const mediaIds = episodes.map((e) => e.id);
    const { data: progress } = await supabase
      .from("user_progress")
      .select("media_id, playback_position, completed")
      .eq("profile_id", user.id)
      .in("media_id", mediaIds);
    for (const p of progress || []) {
      progressMap[p.media_id] = { position: p.playback_position, completed: p.completed };
    }
  }

  // Find first unwatched episode for the main Play button
  const firstUnwatched = episodes.find((ep) => !progressMap[ep.id]?.completed) || episodes[0];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero */}
      <div className="relative w-full" style={{ height: "60vh", minHeight: "400px" }}>
        {backdropUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backdropUrl}
            alt={displayTitle}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black" />
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30" />

        {/* Back button */}
        <Link
          href="/"
          className="absolute top-6 left-6 flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm z-10"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Link>

        {/* Hero content */}
        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 z-10">
          <div className="flex gap-6 items-end max-w-5xl">
            {/* Poster */}
            {posterUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={posterUrl}
                alt={displayTitle}
                className="hidden md:block w-32 h-48 object-cover rounded-xl shadow-2xl border border-white/10 flex-shrink-0"
              />
            )}
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                  showMeta.media_type === "anime"
                    ? "bg-purple-500/80 border-purple-400/20 text-white"
                    : "bg-blue-500/80 border-blue-400/20 text-white"
                }`}>
                  {showMeta.media_type === "anime" ? "Anime" : "TV Show"}
                </span>
                <span className="text-white/50 text-xs">{episodes.length} Episode{episodes.length !== 1 ? "s" : ""}</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight drop-shadow-2xl">{displayTitle}</h1>
              {overview && (
                <p className="text-white/75 text-sm md:text-base max-w-xl leading-relaxed line-clamp-3">{overview}</p>
              )}
              <div className="flex items-center gap-3 pt-1">
                <Link
                  href={`/watch/${firstUnwatched.id}`}
                  className="flex items-center gap-2 px-6 py-2.5 bg-white text-black rounded-lg font-bold text-sm hover:bg-white/90 transition-all"
                >
                  <Play className="h-4 w-4 fill-black" />
                  Play
                </Link>
                <SeriesDetailClient seriesName={decoded} defaultType={showMeta.media_type === "movie" ? "movie" : "tv"} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Episodes section */}
      <div className="max-w-5xl mx-auto px-6 md:px-12 py-8 space-y-6">
        {seasons.map((season) => (
          <div key={season} className="space-y-3">
            {seasons.length > 1 && (
              <h2 className="text-lg font-bold text-white/90 border-b border-white/10 pb-2">
                Season {season}
              </h2>
            )}
            <div className="space-y-2">
              {seasonMap[season].map((ep) => {
                const prog = progressMap[ep.id];
                const runtime = ep.runtime;
                const progressPct = prog && runtime && runtime > 0
                  ? Math.min(100, (prog.position / runtime) * 100)
                  : 0;

                return (
                  <EpisodeRow
                    key={ep.id}
                    ep={ep}
                    progressPct={progressPct}
                    completed={prog?.completed ?? false}
                    runtimeStr={formatRuntime(runtime)}
                    fileSizeStr={formatFileSize(ep.file_size)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
