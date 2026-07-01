import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/clients/supabase/admin";

export const dynamic = "force-dynamic";

interface MatchRequestBody {
  mediaId?: string;
  seriesName?: string;
  tmdbId: number;
  type: "movie" | "tv";
}

/**
 * POST /api/metadata/match
 * Manually matches a media item or TV series to a specific TMDB entry.
 *
 * Body: { mediaId?: string, seriesName?: string, tmdbId: number, type: 'movie' | 'tv' }
 * - type === 'movie' + mediaId: updates the single movie row
 * - type === 'tv' + seriesName: updates ALL rows where series = seriesName
 */
export async function POST(request: NextRequest) {
  let body: MatchRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { mediaId, seriesName, tmdbId, type } = body;

  if (typeof tmdbId !== "number") {
    return NextResponse.json({ error: "Missing required field: tmdbId (number)" }, { status: 400 });
  }

  if (type !== "movie" && type !== "tv") {
    return NextResponse.json({ error: "Invalid field: type must be 'movie' or 'tv'" }, { status: 400 });
  }

  if (type === "movie" && !mediaId) {
    return NextResponse.json({ error: "mediaId is required for type 'movie'" }, { status: 400 });
  }

  if (type === "tv" && !seriesName) {
    return NextResponse.json({ error: "seriesName is required for type 'tv'" }, { status: 400 });
  }

  try {
    const adminClient = createAdminClient();

    if (type === "movie") {
      // Fetch full movie details from TMDB directly via movie detail endpoint
      const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}`, {
        headers: {
          accept: "application/json",
          authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
        },
      });

      if (!res.ok) {
        throw new Error(`TMDB movie details fetch failed: ${res.status}`);
      }

      const movieDetails = await res.json() as {
        id: number;
        title: string;
        overview: string;
        poster_path: string | null;
        backdrop_path: string | null;
        runtime: number | null;
      };

      const posterUrl = movieDetails.poster_path
        ? `https://image.tmdb.org/t/p/w500${movieDetails.poster_path}`
        : null;
      const backdropUrl = movieDetails.backdrop_path
        ? `https://image.tmdb.org/t/p/w1280${movieDetails.backdrop_path}`
        : null;

      const { error } = await adminClient
        .from("media_library")
        .update({
          tmdb_id: movieDetails.id,
          title: movieDetails.title,
          poster_url: posterUrl,
          backdrop_url: backdropUrl,
          overview: movieDetails.overview || null,
          runtime: movieDetails.runtime ?? null,
        })
        .eq("id", mediaId!);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: `Movie "${movieDetails.title}" matched to TMDB ID ${tmdbId}`,
      });
    } else {
      // type === 'tv'
      // Fetch full TV show details from TMDB
      const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}`, {
        headers: {
          accept: "application/json",
          authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
        },
      });

      if (!res.ok) {
        throw new Error(`TMDB TV details fetch failed: ${res.status}`);
      }

      const tvDetails = await res.json() as {
        id: number;
        name: string;
        overview: string;
        poster_path: string | null;
        backdrop_path: string | null;
        episode_run_time: number[] | null;
        genre_ids?: number[];
        genres?: Array<{ id: number }>;
        original_language: string;
      };

      const posterUrl = tvDetails.poster_path
        ? `https://image.tmdb.org/t/p/w500${tvDetails.poster_path}`
        : null;
      const backdropUrl = tvDetails.backdrop_path
        ? `https://image.tmdb.org/t/p/w1280${tvDetails.backdrop_path}`
        : null;
      const runtime =
        tvDetails.episode_run_time && tvDetails.episode_run_time.length > 0
          ? tvDetails.episode_run_time[0]
          : null;

      // Check for anime reclassification
      const genreIds = tvDetails.genres?.map((g) => g.id) ?? tvDetails.genre_ids ?? [];
      const isAnimation = genreIds.includes(16);
      const isJapanese = tvDetails.original_language === "ja";
      const mediaType = isAnimation && isJapanese ? "anime" : "tv-show";

      // Update ALL episodes with this series name
      const { error } = await adminClient
        .from("media_library")
        .update({
          tmdb_id: tvDetails.id,
          poster_url: posterUrl,
          backdrop_url: backdropUrl,
          overview: tvDetails.overview || null,
          runtime,
          media_type: mediaType,
        })
        .eq("series", seriesName!);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: `TV series "${seriesName}" matched to TMDB ID ${tmdbId} (${tvDetails.name}). Media type: ${mediaType}.`,
      });
    }
  } catch (err) {
    console.error("[API /metadata/match] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}
