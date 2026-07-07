import { NextResponse } from "next/server";
import { waitUntil } from "next/server";
import { DriveSyncService } from "@/server/services/drive-sync-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  console.log("[Sync API] Route hit! Request Headers:", Object.fromEntries(req.headers.entries()));
  
  const syncService = new DriveSyncService();
  const baseUrl = new URL(req.url).origin;

  // Process sync asynchronously in the background so Netlify doesn't time out
  waitUntil(
    syncService.sync()
      .then((result) => {
        console.log("[Sync API] Background sync completed successfully:", result);
        
        // Trigger background embedding generator for any newly synced files automatically
        return fetch(`${baseUrl}/api/admin/embed`, { method: "POST" })
          .then((embedRes) => embedRes.json())
          .then((embedData) => console.log("[Sync API] Background embedding complete:", embedData));
      })
      .catch((err) => {
        console.error("[Sync API] Background sync execution failed:", err);
      })
  );

  return NextResponse.json({
    success: true,
    message: "Synchronization started in the background. Your library will update in about a minute."
  });
}
