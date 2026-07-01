import { NextRequest, NextResponse } from "next/server";
import { TmdbService } from "@/server/services/tmdb-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/metadata/search?query=...&type=movie|tv
 * Returns multiple TMDB search results for the manual match UI.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("query");
  const type = searchParams.get("type") as "movie" | "tv" | null;

  if (!query || !query.trim()) {
    return NextResponse.json({ error: "Missing required query parameter: query" }, { status: 400 });
  }

  if (!type || (type !== "movie" && type !== "tv")) {
    return NextResponse.json({ error: "Missing or invalid query parameter: type (must be 'movie' or 'tv')" }, { status: 400 });
  }

  try {
    const tmdb = new TmdbService();
    const results = await tmdb.searchAll(query.trim(), type);
    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("[API /metadata/search] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}
