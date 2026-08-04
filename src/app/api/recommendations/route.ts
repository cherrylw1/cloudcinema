import { NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";
import { createAdminClient } from "@/clients/supabase/admin";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type MediaRow = Database["public"]["Tables"]["media_library"]["Row"];
type MediaType = "movie" | "tv-show";

interface SimilarMatch {
  id: string;
  similarity: number;
}

interface RankedCandidate {
  row: MediaRow;
  key: string;
  score: number;
  similarity: number;
}

const GENRE_SHELVES: Record<number, string> = {
  12: "Adventure & Escape",
  14: "Fantasy Worlds",
  18: "Drama & Human Stories",
  27: "Horror After Dark",
  28: "Action & Adrenaline",
  35: "Comedy & Light Escapes",
  36: "History Revisited",
  37: "Western Horizons",
  53: "Thrillers & Tension",
  80: "Crime & Consequences",
  878: "Science Fiction & Wonder",
  9648: "Mystery & Intrigue",
  10749: "Romance & Connection",
  10751: "Family Viewing",
  10752: "War Stories",
  10759: "Action TV",
  10765: "Fantasy TV",
  10768: "History TV",
  10766: "Serial Drama",
  10767: "Talk & Reality",
};

function canonicalKey(row: Pick<MediaRow, "media_type" | "tmdb_id" | "series" | "title">) {
  const type: MediaType = row.media_type === "movie" ? "movie" : "tv-show";
  if (row.tmdb_id && row.tmdb_id > 0) return `${type}:tmdb:${row.tmdb_id}`;
  const title = type === "movie" ? row.title : row.series || row.title;
  return `${type}:title:${title.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

function displayTitle(row: MediaRow) {
  return row.media_type === "movie" ? row.title : row.series || row.title;
}

function asGenreIds(value: Database["public"]["Tables"]["media_library"]["Row"]["tmdb_genre_ids"]) {
  return Array.isArray(value) ? value.filter((id): id is number => typeof id === "number") : [];
}

function rankScore(row: MediaRow, similarity: number) {
  const quality = Math.max(0, Math.min(1, (row.tmdb_vote_average || 0) / 10));
  const popularity = Math.max(0, Math.min(1, Math.log10(1 + (row.tmdb_popularity || 0)) / 3));
  return similarity * 0.65 + quality * 0.2 + popularity * 0.15;
}

function chooseRepresentative(rows: MediaRow[], similarityById: Map<string, number>) {
  return [...rows].sort((a, b) => {
    const aSimilarity = similarityById.get(a.id) || 0;
    const bSimilarity = similarityById.get(b.id) || 0;
    const aPoster = a.poster_url ? 1 : 0;
    const bPoster = b.poster_url ? 1 : 0;
    return bPoster - aPoster || bSimilarity - aSimilarity || (a.episode || 0) - (b.episode || 0);
  })[0];
}

export async function POST() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: watchHistory } = await supabase
      .from("user_progress")
      .select("playback_position, completed, last_watched, media_library:media_id (*)")
      .eq("profile_id", user.id)
      .order("last_watched", { ascending: false })
      .limit(12);

    const historyRows = (watchHistory || [])
      .map((item) => Array.isArray(item.media_library) ? item.media_library[0] : item.media_library)
      .filter((row): row is MediaRow => Boolean(row) && row.media_type !== "anime");
    const watchedKeys = new Set(historyRows.map(canonicalKey));
    const historyWithEmbeddings = historyRows.filter((row) => row.embedding !== null).slice(0, 8);

    const similarityById = new Map<string, number>();
    const similarityResponses = await Promise.all(historyWithEmbeddings.map(async (watched) => {
      const { data } = await supabase.rpc("match_media", {
        query_embedding: watched.embedding,
        match_threshold: 0.28,
        match_count: 20,
      });
      return (data || []) as SimilarMatch[];
    }));

    for (const matches of similarityResponses) {
      for (const match of matches) {
        if (match.id && typeof match.similarity === "number") {
          similarityById.set(match.id, Math.max(similarityById.get(match.id) || 0, match.similarity));
        }
      }
    }

    const similarityIds = Array.from(similarityById.keys());
    const { data: similarityRows } = similarityIds.length > 0
      ? await supabase.from("media_library").select("*").in("id", similarityIds)
      : { data: [] as MediaRow[] };
    const similarityRowList = ((similarityRows || []) as MediaRow[])
      .filter((row) => row.media_type !== "anime" && row.poster_url);

    const { data: generalRows } = await supabase
      .from("media_library")
      .select("*")
      .in("media_type", ["movie", "tv-show"])
      .not("tmdb_id", "is", null)
      .not("poster_url", "is", null)
      .order("tmdb_vote_average", { ascending: false, nullsFirst: false })
      .limit(240);

    const allCandidates = [...similarityRowList, ...((generalRows || []) as MediaRow[])];
    const candidatesByKey = new Map<string, MediaRow[]>();
    for (const row of allCandidates) {
      const key = canonicalKey(row);
      if (watchedKeys.has(key)) continue;
      const rows = candidatesByKey.get(key) || [];
      rows.push(row);
      candidatesByKey.set(key, rows);
    }

    const rankedCandidates: RankedCandidate[] = Array.from(candidatesByKey.entries())
      .map(([key, rows]) => {
        const row = chooseRepresentative(rows, similarityById);
        const similarity = Math.max(...rows.map((candidate) => similarityById.get(candidate.id) || 0));
        return { row, key, similarity, score: rankScore(row, similarity) };
      })
      .sort((a, b) => b.score - a.score);

    const recommendations = rankedCandidates.slice(0, 12).map(({ row, similarity }) => ({
      id: row.id,
      title: displayTitle(row),
      reason: similarity > 0.35
        ? "A strong match for the themes and stories you have been watching."
        : "A highly rated title from your library that deserves a spot next.",
    }));

    const marathons: Array<{ title: string; reason: string; itemIds: string[] }> = [];
    const usedMarathonKeys = new Set<string>();
    for (const [genreId, shelfTitle] of Object.entries(GENRE_SHELVES)) {
      if (marathons.length >= 5) break;
      const items = rankedCandidates
        .filter(({ row, key }) => !usedMarathonKeys.has(key) && asGenreIds(row.tmdb_genre_ids).includes(Number(genreId)))
        .slice(0, 5);
      if (items.length < 3) continue;
      items.forEach((item) => usedMarathonKeys.add(item.key));
      marathons.push({
        title: shelfTitle,
        reason: "A focused shelf built from the strongest matching titles in your library.",
        itemIds: items.map((item) => item.row.id),
      });
    }

    const recommendationsData = { recommendations, marathons };
    const { error: saveError } = await adminClient
      .from("profiles")
      .update({
        recommendations: {
          version: 2,
          updatedAt: new Date().toISOString(),
          data: recommendationsData,
        },
      })
      .eq("id", user.id);

    if (saveError) console.error("[Recommendations API] Failed to cache results:", saveError);
    return NextResponse.json(recommendationsData);
  } catch (error) {
    console.error("[Recommendations API] Server error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
