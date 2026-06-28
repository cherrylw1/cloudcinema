"use server";

import { DriveSyncService } from "@/server/services/drive-sync-service";

export interface SyncResult {
  success: boolean;
  scanned?: number;
  added?: number;
  updated?: number;
  skipped?: number;
  error?: string;
}

export async function syncLibraryAction(): Promise<SyncResult> {
  try {
    const syncService = new DriveSyncService();
    const result = await syncService.sync();
    return {
      success: true,
      scanned: result.scanned,
      added: result.added,
      updated: result.updated,
      skipped: result.skipped,
    };
  } catch (err) {
    console.error("Failed to sync library:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred during sync.",
    };
  }
}
