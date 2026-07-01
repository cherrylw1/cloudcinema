import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/clients/supabase/admin";
import { google } from "googleapis";
import { env } from "@/config/env";

export const dynamic = "force-dynamic";

interface DeleteRequestBody {
  ids: string[];
}

export async function POST(request: NextRequest) {
  let body: DeleteRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { ids } = body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Missing required field: ids (string[])" }, { status: 400 });
  }

  try {
    const adminClient = createAdminClient();
    
    // 1. Fetch file records to get drive_file_ids
    const { data: records, error: fetchError } = await adminClient
      .from("media_library")
      .select("id, drive_file_id, title")
      .in("id", ids);

    if (fetchError) throw fetchError;
    if (!records || records.length === 0) {
      return NextResponse.json({ error: "No records found matching the provided IDs" }, { status: 404 });
    }

    // 2. Initialize Google Drive client
    const oauth2Client = new google.auth.OAuth2(
      env.googleClientId,
      env.googleClientSecret,
      env.googleRedirectUri
    );
    oauth2Client.setCredentials({
      refresh_token: env.googleRefreshToken,
    });
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    let driveDeletedCount = 0;
    let driveFailedCount = 0;
    const failures: string[] = [];

    // 3. Delete files from Google Drive
    for (const record of records) {
      try {
        console.log(`[Delete API] Deleting file from Google Drive: ${record.title} (${record.drive_file_id})`);
        await drive.files.delete({ fileId: record.drive_file_id });
        driveDeletedCount++;
      } catch (err) {
        console.warn(`[Delete API] Failed to delete file ${record.title} from Google Drive:`, err);
        driveFailedCount++;
        failures.push(`${record.title}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    // 4. Delete records from database
    const { error: deleteError } = await adminClient
      .from("media_library")
      .delete()
      .in("id", ids);

    if (deleteError) throw deleteError;

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${records.length} items from database. ${
        driveDeletedCount > 0 ? `Removed ${driveDeletedCount} files from Google Drive.` : ""
      }${driveFailedCount > 0 ? ` Skipped ${driveFailedCount} files on Google Drive (read-only or already deleted).` : ""}`,
      driveDeletedCount,
      driveFailedCount,
      failures: failures.length > 0 ? failures : undefined,
    });

  } catch (err) {
    console.error("[Delete API] Fatal error:", err);
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred."
    }, { status: 500 });
  }
}
