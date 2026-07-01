import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/clients/supabase/admin";

export const dynamic = "force-dynamic";

interface GroupRequestBody {
  ids: string[];
  seriesName: string;
}

/**
 * POST /api/media/group
 * Groups multiple media rows into a TV series.
 *
 * Body: { ids: string[], seriesName: string }
 * - Sets series = seriesName, media_type = 'tv-show' for all rows with IDs in the array
 * - Assigns sequential episode numbers (1, 2, 3...) in the order the IDs are provided
 */
export async function POST(request: NextRequest) {
  let body: GroupRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { ids, seriesName } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Missing or empty required field: ids (string[])" }, { status: 400 });
  }

  if (!seriesName || typeof seriesName !== "string" || !seriesName.trim()) {
    return NextResponse.json({ error: "Missing required field: seriesName (string)" }, { status: 400 });
  }

  try {
    const adminClient = createAdminClient();
    const trimmedSeriesName = seriesName.trim();

    // Update all rows in order, assigning sequential episode numbers
    const updatePromises = ids.map((id, index) =>
      adminClient
        .from("media_library")
        .update({
          series: trimmedSeriesName,
          media_type: "tv-show",
          episode: index + 1, // 1-based sequential episode numbers
        })
        .eq("id", id)
    );

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

    return NextResponse.json({
      success: true,
      message: `Successfully grouped ${ids.length} items into series "${trimmedSeriesName}".`,
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
