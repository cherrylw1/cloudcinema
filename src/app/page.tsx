import Link from "next/link";
import { createClient } from "@/clients/supabase/server";
import { MediaRow } from "@/components/media/MediaRow";
import { RecommendationsRevalidator } from "@/components/media/RecommendationsRevalidator";
import { CinematicHero } from "@/components/media/CinematicHero";
import type { Media } from "@/repositories/media";
import type { Database } from "@/types/database";
import { TmdbService } from "@/server/services/tmdb-service";

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

interface CuratedMarathon {
  title: string;
  reason: string;
  items: Media[];
}

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // ── Continue Watching & User Watch History ──────────────────────────────────
  let continueWatching: Media[] = [];
  let userWatchHistory: { tmdbId: number | null; mediaType: string }[] = [];

  if (user) {
    const { data } = await supabase
      .from("user_progress")
      .select(`playback_position, last_watched, completed, media_library:media_id (*)`)
      .eq("profile_id", user.id)
      .order("last_watched", { ascending: false })
      .limit(40);

    if (data) {
      // Get active in-progress items
      const activeItems = data.filter((item) => !item.completed && item.playback_position > 0);
      continueWatching = activeItems
        .map((item) => {
          const mediaArr = item.media_library;
          const m = Array.isArray(mediaArr) ? mediaArr[0] : mediaArr;
          return m ? dbRowToMedia(m as MediaRow_DB) : null;
        })
        .filter((m): m is Media => m !== null)
        .slice(0, 20);

      // Compile watch history TMDB IDs for recommendation engine
      const historyList: typeof userWatchHistory = [];
      for (const item of data) {
        const mediaArr = item.media_library;
        const m = Array.isArray(mediaArr) ? mediaArr[0] : mediaArr;
        if (m && (m as MediaRow_DB).tmdb_id) {
          historyList.push({
            tmdbId: (m as MediaRow_DB).tmdb_id,
            mediaType: (m as MediaRow_DB).media_type,
          });
        }
      }
      userWatchHistory = historyList;
    }
  }

  // Fetch all library catalog items for mapping/fallback
  const { data: catalogData } = await supabase
    .from("media_library")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  const catalogAll = (catalogData || []).map(dbRowToMedia);
  const movies = catalogAll.filter((m) => m.mediaType === "movie").slice(0, 20);
  const tvShows = deduplicateSeries(catalogAll.filter((m) => m.mediaType === "tv-show")).slice(0, 20);
  const anime = deduplicateSeries(catalogAll.filter((m) => m.mediaType === "anime")).slice(0, 20);
  const recentDeduped = deduplicateSeries(catalogAll).slice(0, 30);

  // ── Load Cached Recommendations or Fallback ────────────────────────────────
  let cacheUpdatedAt: string | null = null;
  let llmRecommendations: Media[] = [];
  let llmMarathons: CuratedMarathon[] = [];
  let useLlmRecommendations = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("recommendations")
      .eq("id", user.id)
      .single();

    if (profile?.recommendations) {
      const cache = profile.recommendations as { updatedAt?: string; data?: { recommendations?: Array<{ id: string; reason?: string }>; marathons?: Array<{ title: string; reason?: string; itemIds?: string[] }> } };
      cacheUpdatedAt = cache.updatedAt || null;

      if (cache.data) {
        useLlmRecommendations = true;

        // Compile all target media UUIDs to run a targeted lookup query
        const recIds = (cache.data.recommendations || []).map((r) => r.id);
        const marathonIds = (cache.data.marathons || []).flatMap((m) => m.itemIds || []);
        const allTargetIds = Array.from(new Set([...recIds, ...marathonIds]));

        const libraryMap = new Map<string, Media>();

        if (allTargetIds.length > 0) {
          const { data: matchedRows } = await supabase
            .from("media_library")
            .select("*")
            .in("id", allTargetIds);

          if (matchedRows) {
            for (const row of matchedRows) {
              libraryMap.set(row.id, dbRowToMedia(row as MediaRow_DB));
            }
          }
        }

        // Map recommendations items
        if (cache.data.recommendations) {
          llmRecommendations = cache.data.recommendations
            .map((rec): Media | null => {
              const media = libraryMap.get(rec.id);
              if (media) {
                return { ...media, overview: rec.reason || media.overview || null };
              }
              return null;
            })
            .filter((m): m is Media => m != null);
        }

        // Map marathons categories
        if (cache.data.marathons) {
          llmMarathons = cache.data.marathons
            .map((mar) => {
              const items = (mar.itemIds || [])
                .map((id) => libraryMap.get(id))
                .filter((m): m is Media => m != null);
              if (mar.title && items.length > 0) {
                return { title: mar.title, reason: mar.reason || "", items };
              }
              return null;
            })
            .filter((m): m is CuratedMarathon => m != null);
        }
      }
    }
  }

  // ── TMDB recommendations Fallback if LLM is not ready yet ─────────────────
  let tmdbRecommendations: Media[] = [];
  let showTmdbRecommendations = false;

  if (!useLlmRecommendations && userWatchHistory.length > 0) {
    try {
      const tmdb = new TmdbService();
      const recIdsSet = new Set<number>();
      const recentHistory = userWatchHistory.slice(0, 5);

      for (const item of recentHistory) {
        if (!item.tmdbId) continue;
        const type = item.mediaType === "movie" ? "movie" : "tv";
        const ids = await tmdb.getRecommendations(item.tmdbId, type);
        for (const id of ids) {
          recIdsSet.add(id);
        }
      }

      const recIds = Array.from(recIdsSet);
      if (recIds.length > 0) {
        const { data: recMediaRows } = await supabase
          .from("media_library")
          .select("*")
          .in("tmdb_id", recIds.slice(0, 60));

        if (recMediaRows) {
          tmdbRecommendations = deduplicateSeries(recMediaRows.map(dbRowToMedia)).slice(0, 20);
          showTmdbRecommendations = tmdbRecommendations.length > 0;
        }
      }
    } catch (err) {
      console.error("[TMDB Fallback Recommendations] Failed:", err);
    }
  }

  // ── Cold Start Fallback Curation (Random Shuffled picks) ────────────────────
  let curatedPicks: Media[] = [];
  if (!useLlmRecommendations && !showTmdbRecommendations) {
    curatedPicks = [...movies, ...tvShows, ...anime]
      .filter((m) => m.posterUrl)
      .sort(() => 0.5 - Math.random())
      .slice(0, 20);
  }

  // ── Hero Banner Selection ──────────────────────────────────────────────────
  const heroSourceList = [
    ...llmRecommendations,
    ...(llmMarathons[0]?.items || []),
    ...tmdbRecommendations,
    ...catalogAll,
  ].filter((m): m is Media => m != null);
  const heroItem = heroSourceList.find((m) => m.backdropUrl && m.overview) || heroSourceList[0];

  const heroTitle = heroItem
    ? (heroItem.mediaType !== "movie" && heroItem.series) ? heroItem.series : heroItem.title
    : null;
  const heroHref = heroItem
    ? (heroItem.mediaType !== "movie" && heroItem.series)
        ? `/series/${encodeURIComponent(heroItem.series!)}`
        : `/movies/${heroItem.id}`
    : "/";

  return (
    <div className="min-h-screen bg-black text-white -mx-6 md:-mx-8 -mt-0">
      {/* Background Stale-While-Revalidate Trigger */}
      {user && <RecommendationsRevalidator cacheUpdatedAt={cacheUpdatedAt} />}

      {/* ──────────────────── HERO BANNER ──────────────────── */}
      {heroItem && (
        <CinematicHero media={heroItem} title={heroTitle} href={heroHref} />
      )}

      {/* ──────────────────── CONTENT ROWS ──────────────────── */}
      <div className="relative z-10 -mt-24 md:-mt-32 px-4 md:px-16 pb-20 space-y-8 md:space-y-10">

        {/* Continue Watching */}
        {continueWatching.length > 0 && (
          <MediaRow
            title={`Continue Watching for ${user?.user_metadata?.full_name?.split(" ")[0] || "You"}`}
            items={continueWatching}
            variant="portrait"
          />
        )}

        {/* Dynamic LLM Curated Marathons */}
        {useLlmRecommendations && llmMarathons.map((mar, index) => (
          <MediaRow
            key={`marathon-${index}`}
            title={mar.title}
            description={mar.reason}
            items={mar.items}
            variant="portrait"
          />
        ))}

        {/* Personalized Recommendations */}
        {useLlmRecommendations && llmRecommendations.length > 0 && (
          <MediaRow
            title="Recommended For You"
            items={llmRecommendations}
            variant="portrait"
          />
        )}

        {/* TMDB Fallback Recommendations */}
        {showTmdbRecommendations && (
          <MediaRow
            title="Recommended For You"
            items={tmdbRecommendations}
            variant="portrait"
          />
        )}

        {/* Shuffled curated fallback picks */}
        {curatedPicks.length > 0 && (
          <MediaRow
            title="Curated For You"
            items={curatedPicks}
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
