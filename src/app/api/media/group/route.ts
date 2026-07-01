import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/clients/supabase/admin";

export const dynamic = "force-dynamic";

interface GroupRequestBody {
  ids: string[];
  mediaType: "movie" | "tv-show" | "anime";
  seriesName?: string;
}

/**
 * POST /api/media/group
 * Groups multiple media rows into a movie category or a TV/Anime series.
 *
 * Body: { ids: string[], mediaType: "movie" | "tv-show" | "anime", seriesName?: string }
 */
export async function POST(request: NextRequest) {
  let body: GroupRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { ids, mediaType, seriesName } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Missing or empty required field: ids (string[])" }, { status: 400 });
  }

  const validMediaTypes = ["movie", "tv-show", "anime"];
  if (!mediaType || !validMediaTypes.includes(mediaType)) {
    return NextResponse.json(
      { error: "Invalid or missing required field: mediaType must be 'movie', 'tv-show', or 'anime'" },
      { status: 400 }
    );
  }

  if (
    (mediaType === "tv-show" || mediaType === "anime") &&
    (!seriesName || typeof seriesName !== "string" || !seriesName.trim())
  ) {
    return NextResponse.json(
      { error: `Missing required field: seriesName is required for mediaType '${mediaType}'` },
      { status: 400 }
    );
  }

  try {
    const adminClient = createAdminClient();
    const trimmedSeriesName = seriesName?.trim();

    // Update all rows in order based on media type
    const updatePromises = ids.map((id, index) => {
      const updatePayload = mediaType === "movie"
        ? {
            media_type: "movie" as const,
            series: null,
            season: null,
            episode: null,
          }
        : {
            series: trimmedSeriesName,
            media_type: mediaType,
            episode: index + 1, // 1-based sequential episode numbers
            season: 1,
          };

      return adminClient
        .from("media_library")
        .update(updatePayload)
        .eq("id", id);
    });

    const results = await Promise.all(updatePromises);

    // Check for any errors
    const errors = results
      .map((r, i) => (r.error ? { id: ids[i], error: r.error.message } : null))
      .filter(Boolean);

    if (errors.length > 0) {
      console.error("[API /media/group] Some updates failed:", errors);
      return NextResponse.json(
        {
          success: false,
          error: `${errors.length} of ${ids.length} updates failed.`,
          failures: errors,
        },
        { status: 207 }
      );
    }

    const successMessage = mediaType === "movie"
      ? `Successfully grouped ${ids.length} items as movies.`
      : `Successfully grouped ${ids.length} items into ${mediaType} series "${trimmedSeriesName}".`;

    return NextResponse.json({
      success: true,
      message: successMessage,
      count: ids.length,
    });
  } catch (err) {
    console.error("[API /media/group] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}
