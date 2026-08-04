import { NextResponse } from "next/server";
import { MetadataSyncService } from "@/server/services/metadata-sync-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    let retryUnmatched = true;
    try {
      const body = await request.json() as { retryUnmatched?: boolean };
      if (typeof body.retryUnmatched === "boolean") {
        retryUnmatched = body.retryUnmatched;
      }
    } catch {
      // Empty request bodies are supported for existing callers.
    }

    const syncService = new MetadataSyncService();
    const result = await syncService.syncBatch(200, { retryUnmatched });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("Failed to sync metadata:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "An unexpected error occurred during metadata sync.",
      },
      { status: 500 }
    );
  }
}
