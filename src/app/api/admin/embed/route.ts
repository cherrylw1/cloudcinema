import { NextResponse } from "next/server";
import { createAdminClient } from "@/clients/supabase/admin";
import { EmbeddingService } from "@/server/services/embedding-service";

export const dynamic = "force-dynamic";

export async function POST() {
  return generateEmbeddings();
}

export async function GET() {
  return generateEmbeddings();
}

async function generateEmbeddings() {
  try {
    const adminClient = createAdminClient();
    const embedder = new EmbeddingService();

    // 1. Fetch library items missing embeddings (limit to 50 per batch to avoid timeouts)
    const { data: missing, error } = await adminClient
      .from("media_library")
      .select("id, title, series, overview, media_type")
      .is("embedding", null)
      .limit(50);

    if (error) {
      console.error("[EmbedWorker] Failed to query missing embeddings:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!missing || missing.length === 0) {
      return NextResponse.json({
        message: "All library files are already semantically embedded.",
        processed: 0,
        remaining: 0,
      });
    }

    console.log(`[EmbedWorker] Processing batch of ${missing.length} missing embeddings...`);
    let successCount = 0;

    for (const item of missing) {
      // Build a detailed semantic text description representing the item's content/mood
      const semanticContext = [
        item.series || item.title,
        item.media_type === "movie" ? "Movie" : item.media_type === "tv-show" ? "TV Show" : "Anime",
        item.overview || "",
      ]
        .filter(Boolean)
        .join(" - ");

      try {
        const vector = await embedder.getEmbedding(semanticContext);

        const { error: updateError } = await adminClient
          .from("media_library")
          .update({ embedding: vector as any })
          .eq("id", item.id);

        if (updateError) {
          console.error(`[EmbedWorker] Failed to write embedding for id ${item.id}:`, updateError);
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`[EmbedWorker] Skipping id ${item.id} due to embedding generation error:`, err);
      }
    }

    // Query remaining count
    const { count } = await adminClient
      .from("media_library")
      .select("*", { count: "exact", head: true })
      .is("embedding", null);

    return NextResponse.json({
      message: `Successfully generated ${successCount} embeddings.`,
      processed: successCount,
      remaining: count || 0,
    });
  } catch (err: any) {
    console.error("[EmbedWorker] Server error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
