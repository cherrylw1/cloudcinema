import { NextResponse } from "next/server";
import { DriveSyncService } from "@/server/services/drive-sync-service";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const syncService = new DriveSyncService();
    const result = await syncService.sync();

    // Trigger background embedding generator for any newly synced files automatically
    const baseUrl = new URL(req.url).origin;
    fetch(`${baseUrl}/api/admin/embed`, { method: "POST" }).catch((e) =>
      console.error("[Sync] Background embedding trigger failed:", e)
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("Failed to sync library:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "An unexpected error occurred during sync.",
      },
      { status: 500 }
    );
  }
}
