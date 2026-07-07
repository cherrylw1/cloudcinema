import { NextResponse } from "next/server";
import { DriveSyncService } from "@/server/services/drive-sync-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  console.log("[Sync API] Route hit! Request Headers:", Object.fromEntries(req.headers.entries()));
  
  try {
    const syncService = new DriveSyncService();
    const result = await syncService.sync({ full: false });

    // Trigger background embedding generator for any newly synced files automatically (non-blocking)
    const baseUrl = new URL(req.url).origin;
    fetch(`${baseUrl}/api/admin/embed`, { method: "POST" })
      .then((embedRes) => embedRes.json())
      .then((embedData) => console.log("[Sync API] Background embedding trigger result:", embedData))
      .catch((e) => console.error("[Sync API] Background embedding trigger failed:", e));

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
