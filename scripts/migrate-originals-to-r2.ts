/* eslint-disable @typescript-eslint/no-explicit-any */
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import type { R2Original } from "../src/repositories/media";
import {
  getR2StorageConfig,
  r2KeyForOriginal,
  uploadR2Stream,
} from "../src/server/r2-storage";

const PAGE_SIZE = Math.max(1, Number(process.env.R2_ORIGINAL_MIGRATION_PAGE_SIZE || 1));

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function metadataObject(value: unknown) {
  if (Array.isArray(value)) return { version: 2, tracks: value } as Record<string, unknown>;
  if (!value || typeof value !== "object") return { version: 2, tracks: [] } as Record<string, unknown>;
  return value as Record<string, unknown>;
}

async function updateOriginal(
  supabase: any,
  mediaId: string,
  metadata: Record<string, unknown>,
  original: R2Original,
) {
  const { error } = await supabase
    .from("media_library")
    .update({ audio_streams: { ...metadata, r2Original: original } })
    .eq("id", mediaId);
  if (error) throw error;
}

async function migrateMedia(supabase: any, drive: any, media: any) {
  const sourceFileId = media.processed_drive_file_id || media.drive_file_id;
  if (!sourceFileId) return false;

  const metadata = metadataObject(media.audio_streams);
  const existing = metadata.r2Original as R2Original | undefined;
  if (existing?.key && existing.driveFileId === sourceFileId) return false;

  const driveMetadata = await drive.files.get({
    fileId: sourceFileId,
    fields: "size,mimeType",
  });
  const fileSize = Number(driveMetadata.data.size || media.file_size || 0);
  const contentType = media.mime_type || driveMetadata.data.mimeType || "video/mp4";
  const response = await drive.files.get(
    { fileId: sourceFileId, alt: "media" },
    { responseType: "stream" },
  );
  const key = r2KeyForOriginal(media.id, sourceFileId);

  console.log(`Uploading original ${media.title} (${media.id}) to R2...`);
  const r2Etag = await uploadR2Stream(response.data, key, contentType, fileSize || undefined);
  if (!r2Etag) throw new Error("R2 is not configured for this migration runner.");

  await updateOriginal(supabase, media.id, metadata, {
    key,
    driveFileId: sourceFileId,
    fileSize,
    contentType,
    r2Etag,
  });
  console.log(`Migrated original ${media.title} (${media.id}) to R2.`);
  return true;
}

async function main() {
  if (!getR2StorageConfig()) {
    throw new Error("Original migration requires CLOUDFLARE_R2_* environment variables.");
  }

  const supabase = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
  );
  const oauth2Client = new google.auth.OAuth2(
    required("GOOGLE_CLIENT_ID"),
    required("GOOGLE_CLIENT_SECRET"),
    "urn:ietf:wg:oauth:2.0:oob",
  );
  oauth2Client.setCredentials({ refresh_token: required("GOOGLE_REFRESH_TOKEN") });
  const drive = google.drive({ version: "v3", auth: oauth2Client });
  const requestedMediaId = process.argv[2] && process.argv[2] !== "batch" ? process.argv[2] : null;

  if (requestedMediaId) {
    const { data, error } = await supabase
      .from("media_library")
      .select("id,title,drive_file_id,processed_drive_file_id,mime_type,file_size,audio_streams")
      .eq("id", requestedMediaId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`Media ${requestedMediaId} was not found.`);
    await migrateMedia(supabase, drive, data);
    return;
  }

  let offset = 0;
  let migrated = 0;
  while (true) {
    const { data, error } = await supabase
      .from("media_library")
      .select("id,title,drive_file_id,processed_drive_file_id,mime_type,file_size,audio_streams")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const media of data) {
      try {
        if (await migrateMedia(supabase, drive, media)) migrated += 1;
      } catch (error) {
        console.error(`Failed to migrate ${media.title} (${media.id}):`, error);
      }
    }
    offset += data.length;
  }

  console.log(`Original R2 migration pass complete. Updated ${migrated} media item(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
