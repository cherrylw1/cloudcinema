import { NextResponse } from "next/server";
import { DriveSyncService } from "@/server/services/drive-sync-service";

export const maxDuration = 300;

export async function POST() {
  try {
    const syncService = new DriveSyncService();
    const result = await syncService.sync();
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
