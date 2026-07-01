import Link from "next/link";
import { createClient } from "@/clients/supabase/server";
import { Play, Info } from "lucide-react";
import { MediaRow } from "@/components/media/MediaRow";
import type { Media } from "@/repositories/media";
import type { Database } from "@/types/database";

type MediaRow_DB = Database["public"]["Tables"]["media_library"]["Row"];

function dbRowToMedia(row: MediaRow_DB): Media {
  return {
    id: row.id,
    driveFileId: row.drive_file_id,
    title: row.title,
    series: row.series,
    season: row.season,
    episode: row.episode,
    mediaType: row.media_type,
    overview: row.overview,
    posterUrl: row.poster_url,
    backdropUrl: row.backdrop_url,
    runtime: row.runtime,
    fileSize: row.file_size,
    tmdbId: row.tmdb_id,
    mimeType: row.mime_type,
    dvProfile: row.dv_profile,
    audioCodec: row.audio_codec,
    audioStreams: null,
    subtitleStreams: null,
    processingStatus: row.processing_status,
    audioVariants: null,
    subtitleTracks: null,
    processedDriveFileId: row.processed_drive_file_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Deduplicate TV/Anime by series name, keeping only one representative per series */
function deduplicateSeries(items: Media[]): Media[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (item.mediaType === "movie") return true;
    const key = item.series || item.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // ── Continue Watching ──────────────────────────────────────────────────────
  let continueWatching: Media[] = [];
  if (user) {
    const { data } = await supabase
      .from("user_progress")
      .select(`playback_position, last_watched, completed, media_library:media_id (*)`)
      .eq("profile_id", user.id)
      .eq("completed", false)
      .gt("playback_position", 0)
      .order("last_watched", { ascending: false })
      .limit(20);

    if (data) {
      continueWatching = data
        .map((item) => {
          const mediaArr = item.media_library;
          const m = Array.isArray(mediaArr) ? mediaArr[0] : mediaArr;
          return m ? dbRowToMedia(m as MediaRow_DB) : null;
        })
        .filter((m): m is Media => m !== null);
    }
  }

  // ── Recently Added ─────────────────────────────────────────────────────────
  const { data: recentData } = await supabase
    .from("media_library")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(60);
  const recentAll = (recentData || []).map(dbRowToMedia);

  // ── Movies ─────────────────────────────────────────────────────────────────
  const { data: movieData } = await supabase
    .from("media_library")
    .select("*")
    .eq("media_type", "movie")
    .order("created_at", { ascending: false })
    .limit(40);
  const movies = (movieData || []).map(dbRowToMedia);

  // ── TV Shows ───────────────────────────────────────────────────────────────
  const { data: tvData } = await supabase
    .from("media_library")
    .select("*")
    .eq("media_type", "tv-show")
    .order("series", { ascending: true })
    .limit(200);
  const tvShows = deduplicateSeries((tvData || []).map(dbRowToMedia));

  // ── Anime ──────────────────────────────────────────────────────────────────
  const { data: animeData } = await supabase
    .from("media_library")
    .select("*")
    .eq("media_type", "anime")
    .order("series", { ascending: true })
    .limit(200);
  const anime = deduplicateSeries((animeData || []).map(dbRowToMedia));

  // ── Hero item: pick from recently added with a backdrop ────────────────────
  const heroItem = recentAll.find((m) => m.backdropUrl) || recentAll[0];

  const heroTitle = heroItem
    ? (heroItem.mediaType !== "movie" && heroItem.series) ? heroItem.series : heroItem.title
    : null;
  const heroHref = heroItem
    ? (heroItem.mediaType !== "movie" && heroItem.series)
        ? `/series/${encodeURIComponent(heroItem.series!)}`
        : `/movies/${heroItem.id}`
    : "/";

  // Recently added: deduplicate, limit to 30
  const recentDeduped = deduplicateSeries(recentAll).slice(0, 30);

  return (
    <div className="min-h-screen bg-black text-white -mx-6 md:-mx-8 -mt-0">

      {/* ──────────────────── HERO BANNER ──────────────────── */}
      {heroItem && (
        <div className="relative w-full" style={{ height: "85vh", minHeight: "500px" }}>
          {/* Backdrop */}
          {heroItem.backdropUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroItem.backdropUrl}
              alt={heroTitle || ""}
              className="absolute inset-0 w-full h-full object-cover"
              priority-hint="high"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black" />
          )}

          {/* Gradient layers */}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />

          {/* Hero content */}
          <div className="absolute bottom-0 left-0 right-0 px-8 md:px-16 pb-24 md:pb-32 z-10 max-w-3xl">
            <div className="space-y-4">
              {/* Badge */}
              <span className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded border ${
                heroItem.mediaType === "anime"
                  ? "bg-purple-500/80 border-purple-400/20 text-white"
                  : heroItem.mediaType === "tv-show"
                  ? "bg-blue-500/80 border-blue-400/20 text-white"
                  : "bg-brand-primary/80 border-red-400/20 text-white"
              }`}>
                {heroItem.mediaType === "anime" ? "Anime" : heroItem.mediaType === "tv-show" ? "TV Show" : "Movie"}
              </span>

              {/* Title */}
              <h1 className="text-4xl md:text-6xl font-black text-white leading-tight drop-shadow-2xl">
                {heroTitle}
              </h1>

              {/* Overview */}
              {heroItem.overview && (
                <p className="text-base md:text-lg text-white/80 leading-relaxed max-w-xl line-clamp-3">
                  {heroItem.overview}
                </p>
              )}

              {/* Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <Link
                  href={`/watch/${heroItem.id}`}
                  className="flex items-center gap-2 px-8 py-3 bg-white text-black rounded-lg font-bold text-base hover:bg-white/90 transition-all shadow-xl"
                >
                  <Play className="h-5 w-5 fill-black" />
                  Play
                </Link>
                <Link
                  href={heroHref}
                  className="flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-sm text-white rounded-lg font-semibold text-base hover:bg-white/30 border border-white/20 transition-all"
                >
                  <Info className="h-5 w-5" />
                  More Info
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────── CONTENT ROWS ──────────────────── */}
      <div className="relative z-10 -mt-32 px-8 md:px-16 pb-20 space-y-10">

        {/* Continue Watching */}
        {continueWatching.length > 0 && (
          <MediaRow
            title={`Continue Watching for ${user?.user_metadata?.full_name?.split(" ")[0] || "You"}`}
            items={continueWatching}
            variant="portrait"
          />
        )}

        {/* Recently Added */}
        {recentDeduped.length > 0 && (
          <MediaRow
            title="Recently Added"
            items={recentDeduped}
            variant="portrait"
          />
        )}

        {/* TV Shows */}
        {tvShows.length > 0 && (
          <MediaRow
            title="Binge-worthy TV Shows"
            items={tvShows}
            variant="portrait"
          />
        )}

        {/* Movies */}
        {movies.length > 0 && (
          <MediaRow
            title="Top Movies"
            items={movies}
            variant="portrait"
          />
        )}

        {/* Anime */}
        {anime.length > 0 && (
          <MediaRow
            title="Anime"
            items={anime}
            variant="portrait"
          />
        )}

        {/* Empty state */}
        {recentDeduped.length === 0 && continueWatching.length === 0 && (
          <div className="text-center py-24 space-y-4">
            <div className="text-6xl">🎬</div>
            <h2 className="text-2xl font-bold text-white">Your library is empty</h2>
            <p className="text-white/50 max-w-md mx-auto">
              Go to Settings and click &quot;Sync Library&quot; to import your media from Google Drive.
            </p>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 mt-4 px-6 py-2.5 bg-brand-primary text-white rounded-lg font-semibold hover:bg-brand-primary/90 transition-all"
            >
              Go to Settings
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
