import { NextResponse } from "next/server";
import { waitUntil } from "next/server";
import { MetadataSyncService } from "@/server/services/metadata-sync-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const syncService = new MetadataSyncService();

  // Run metadata sync asynchronously in the background so Netlify doesn't time out
  waitUntil(
    syncService.syncBatch(200)
      .then((result) => {
        console.log("[Metadata API] Background metadata sync completed successfully:", result);
      })
      .catch((err) => {
        console.error("[Metadata API] Background metadata sync failed:", err);
      })
  );

  return NextResponse.json({
    success: true,
    message: "Metadata fetch started in the background. Movie posters and plots will update in a few seconds."
  });
}
