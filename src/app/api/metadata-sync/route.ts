import { NextResponse } from "next/server";
import { MetadataSyncService } from "@/server/services/metadata-sync-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    const syncService = new MetadataSyncService();
    const result = await syncService.syncBatch(200);
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
