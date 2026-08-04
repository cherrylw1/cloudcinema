import Link from "next/link";
import { createClient } from "@/clients/supabase/server";
import { MediaRow } from "@/components/media/MediaRow";
import { RecommendationsRevalidator } from "@/components/media/RecommendationsRevalidator";
import { CinematicHero } from "@/components/media/CinematicHero";
import { MediaLoadError } from "@/components/media/MediaLoadError";
import {
  MEDIA_CARD_COLUMNS,
  MEDIA_CARD_COLUMNS_WITH_RANKING,
  type Media,
} from "@/repositories/media";
import type { Database } from "@/types/database";
import { TmdbService } from "@/server/services/tmdb-service";

type MediaRow_DB = Database["public"]["Tables"]["media_library"]["Row"];

const HOME_MEDIA_COLUMNS = MEDIA_CARD_COLUMNS;
const HOME_PROGRESS_SELECT =
  `playback_position, last_watched, completed, media_library:media_id (${HOME_MEDIA_COLUMNS})` as const;
const HOME_RANKED_MEDIA_COLUMNS = MEDIA_CARD_COLUMNS_WITH_RANKING;

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
    tmdbPopularity: row.tmdb_popularity,
    tmdbVoteAverage: row.tmdb_vote_average,
    tmdbVoteCount: row.tmdb_vote_count,
    tmdbGenreIds: Array.isArray(row.tmdb_genre_ids) ? row.tmdb_genre_ids as number[] : null,
    tmdbOriginalLanguage: row.tmdb_original_language,
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

function canonicalKey(item: Pick<Media, "mediaType" | "tmdbId" | "series" | "title">) {
  const type = item.mediaType === "movie" ? "movie" : "tv";
  if (item.tmdbId && item.tmdbId > 0) return `${type}:tmdb:${item.tmdbId}`;
  const title = type === "movie" ? item.title : item.series || item.title;
  return `${type}:title:${title.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

function catalogScore(item: Media) {
  const quality = Math.max(0, Math.min(1, (item.tmdbVoteAverage || 0) / 10));
  const popularity = Math.max(0, Math.min(1, Math.log10(1 + (item.tmdbPopularity || 0)) / 3));
  const votes = Math.max(0, Math.min(1, Math.log10(1 + (item.tmdbVoteCount || 0)) / 6));
  return quality * 0.55 + popularity * 0.25 + votes * 0.2;
}

function deduplicateCatalog(items: Media[]) {
  const representatives = new Map<string, Media>();
  for (const item of items) {
    const key = canonicalKey(item);
    const current = representatives.get(key);
    if (!current || (!current.posterUrl && item.posterUrl) || catalogScore(item) > catalogScore(current)) {
      representatives.set(key, item);
    }
  }
  return Array.from(representatives.values());
}

interface CuratedMarathon {
  title: string;
  reason: string;
  items: Media[];
}

const HOME_GENRES: Record<number, string> = {
  18: "Drama & Human Stories",
  27: "Horror After Dark",
  28: "Action & Adrenaline",
  35: "Comedy & Light Escapes",
  53: "Thrillers & Tension",
  80: "Crime & Consequences",
  878: "Science Fiction & Wonder",
  9648: "Mystery & Intrigue",
  10749: "Romance & Connection",
};

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // ── Continue Watching & User Watch History ──────────────────────────────────
  let continueWatching: Media[] = [];
  let userWatchHistory: { tmdbId: number | null; mediaType: string }[] = [];

  if (user) {
    const { data, error: progressError } = await supabase
      .from("user_progress")
      .select(HOME_PROGRESS_SELECT)
      .eq("profile_id", user.id)
      .order("last_watched", { ascending: false })
      .limit(40);

    if (progressError) {
      console.error("[Home] Failed to load watch progress:", progressError);
    }

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
        .filter((item, index, items) => items.findIndex((candidate) => canonicalKey(candidate) === canonicalKey(item)) === index)
        .slice(0, 20);

      // Compile watch history TMDB IDs for recommendation engine
      const historyList: typeof userWatchHistory = [];
      for (const item of data) {
        const mediaArr = item.media_library;
        const m = Array.isArray(mediaArr) ? mediaArr[0] : mediaArr;
        if (m && (m as MediaRow_DB).tmdb_id && (m as MediaRow_DB).media_type !== "anime") {
          historyList.push({
            tmdbId: (m as MediaRow_DB).tmdb_id,
            mediaType: (m as MediaRow_DB).media_type,
          });
        }
      }
      userWatchHistory = historyList;
    }
  }

  // Merge recent and highly rated rows so the Home page can rank the library
  // without treating the newest database records as the best titles.
  const [recentCatalogRes, rankedCatalogRes] = await Promise.all([
    supabase
      .from("media_library")
      .select(HOME_MEDIA_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(320),
    supabase
      .from("media_library")
      .select(HOME_RANKED_MEDIA_COLUMNS)
      .order("tmdb_vote_average", { ascending: false, nullsFirst: false })
      .limit(320),
  ]);

  if (recentCatalogRes.error) {
    console.error("[Home] Failed to load media catalog:", recentCatalogRes.error);
    return (
      <div className="min-h-screen bg-black px-4 py-12 text-white md:px-16">
        <MediaLoadError href="/" />
      </div>
    );
  }

  if (rankedCatalogRes.error) {
    // Ranking metadata is optional. The recent catalog query above is the
    // source of truth when that migration is not available yet.
    console.warn("[Home] Recommendation ranking is unavailable; using catalog fallback.");
  }
  const catalogMap = new Map<string, Media>();
  for (const row of [...(recentCatalogRes.data || []), ...(rankedCatalogRes.data || [])]) {
    catalogMap.set(row.id, dbRowToMedia(row as MediaRow_DB));
  }
  const catalogAll = Array.from(catalogMap.values());
  const allMovies = deduplicateCatalog(catalogAll.filter((m) => m.mediaType === "movie"));
  const allTvShows = deduplicateCatalog(catalogAll.filter((m) => m.mediaType === "tv-show"));
  const anime = deduplicateCatalog(catalogAll.filter((m) => m.mediaType === "anime"));
  const movies = [...allMovies].sort((a, b) => catalogScore(b) - catalogScore(a)).slice(0, 20);
  const tvShows = [...allTvShows].sort((a, b) => catalogScore(b) - catalogScore(a)).slice(0, 20);
  const recentDeduped = deduplicateCatalog([...catalogAll].sort((a, b) => b.createdAt.localeCompare(a.createdAt))).slice(0, 30);

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
      const cache = profile.recommendations as { version?: number; updatedAt?: string; data?: { recommendations?: Array<{ id: string; reason?: string }>; marathons?: Array<{ title: string; reason?: string; itemIds?: string[] }> } };
      cacheUpdatedAt = cache.version === 2 ? cache.updatedAt || null : null;

      if (cache.version === 2 && cache.data) {
        useLlmRecommendations = true;

        // Compile all target media UUIDs to run a targeted lookup query
        const recIds = (cache.data.recommendations || []).map((r) => r.id);
        const marathonIds = (cache.data.marathons || []).flatMap((m) => m.itemIds || []);
        const allTargetIds = Array.from(new Set([...recIds, ...marathonIds]));

        const libraryMap = new Map<string, Media>();

        if (allTargetIds.length > 0) {
          const { data: matchedRows } = await supabase
            .from("media_library")
            .select(HOME_MEDIA_COLUMNS)
            .in("id", allTargetIds);

          if (matchedRows) {
            for (const row of matchedRows) {
              libraryMap.set(row.id, dbRowToMedia(row as MediaRow_DB));
            }
          }
        }

        // Map recommendations items
        if (cache.data.recommendations) {
          llmRecommendations = deduplicateCatalog(cache.data.recommendations
            .map((rec): Media | null => {
              const media = libraryMap.get(rec.id);
              if (media) {
                return { ...media, overview: rec.reason || media.overview || null };
              }
              return null;
            })
            .filter((m): m is Media => m != null)
            .filter((m) => m.mediaType !== "anime"));
        }

        // Map marathons categories
        if (cache.data.marathons) {
          llmMarathons = cache.data.marathons
            .map((mar) => {
              const items = deduplicateCatalog((mar.itemIds || [])
                .map((id) => libraryMap.get(id))
                .filter((m): m is Media => m != null)
                .filter((m) => m.mediaType !== "anime"));
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

      const recommendationBatches = await Promise.all(
        recentHistory
          .filter((item) => item.tmdbId)
          .map((item) => {
            const type = item.mediaType === "movie" ? "movie" : "tv";
            return tmdb.getRecommendations(item.tmdbId as number, type);
          }),
      );
      for (const ids of recommendationBatches) {
        for (const id of ids) recIdsSet.add(id);
      }

      const recIds = Array.from(recIdsSet);
      if (recIds.length > 0) {
        const { data: recMediaRows } = await supabase
          .from("media_library")
          .select(HOME_MEDIA_COLUMNS)
          .in("tmdb_id", recIds.slice(0, 60));

        if (recMediaRows) {
          tmdbRecommendations = deduplicateCatalog(
            recMediaRows
              .map((row) => dbRowToMedia(row as MediaRow_DB))
              .filter((media) => media.mediaType !== "anime"),
          ).slice(0, 20);
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
    curatedPicks = [...movies, ...tvShows]
      .filter((m) => m.posterUrl)
      .slice(0, 20);
  }

  // ── Hero Banner Selection ──────────────────────────────────────────────────
  const heroSourceList = [
    ...llmRecommendations,
    ...(llmMarathons[0]?.items || []),
    ...tmdbRecommendations,
    ...catalogAll.filter((item) => item.mediaType !== "anime"),
  ].filter((m): m is Media => m != null);
  const heroItem = heroSourceList.find((m) => m.backdropUrl && m.overview) || heroSourceList[0];

  const genreRows = Object.entries(HOME_GENRES)
    .map(([genreId, title]) => ({
      title,
      items: [...allMovies, ...allTvShows]
        .filter((item) => item.tmdbGenreIds?.includes(Number(genreId)))
        .sort((a, b) => catalogScore(b) - catalogScore(a))
        .slice(0, 12),
    }))
    .filter((row) => row.items.length >= 4)
    .slice(0, 5);

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

        {/* Genre shelves */}
        {genreRows.map((row) => (
          <MediaRow
            key={row.title}
            title={row.title}
            items={row.items}
            variant="portrait"
          />
        ))}

        {/* TV Shows */}
        {tvShows.length > 0 && (
          <MediaRow
            title="Top TV Shows"
            items={tvShows}
            variant="portrait"
          />
        )}

        {/* Top Movies */}
        {movies.length > 0 && (
          <MediaRow
            title="Top Movies"
            items={movies}
            variant="portrait"
          />
        )}

        {/* Anime library, kept separate from recommendation rows */}
        {anime.length > 0 && (
          <MediaRow
            title="Anime Library"
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
