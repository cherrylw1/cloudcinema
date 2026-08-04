/* eslint-disable @typescript-eslint/no-explicit-any */
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import type { HlsManifest } from "../src/repositories/media";
import {
  getR2StorageConfig,
  r2KeyForRendition,
  uploadR2Stream,
} from "../src/server/r2-storage";

const PAGE_SIZE = Math.max(1, Number(process.env.R2_MIGRATION_PAGE_SIZE || 5));

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function hlsMetadata(value: unknown) {
  if (!value || Array.isArray(value)) return null;
  return value as { browserHls?: HlsManifest; [key: string]: unknown };
}

async function updateManifest(supabase: any, mediaId: string, metadata: Record<string, unknown>, manifest: HlsManifest) {
  const { error } = await supabase
    .from("media_library")
    .update({
      audio_streams: { ...metadata, browserHls: manifest },
    })
    .eq("id", mediaId);
  if (error) throw error;
}

async function migrateRendition(
  drive: any,
  mediaId: string,
  rendition: HlsManifest["video"] | HlsManifest["audio"][number],
  kind: "video" | "audio",
  index?: number,
) {
  if (rendition.r2Key) return rendition;

  console.log(`Uploading ${kind}${index === undefined ? "" : ` ${index}`} for ${mediaId} to R2...`);
  const response = await drive.files.get(
    { fileId: rendition.driveFileId, alt: "media" },
    { responseType: "stream" },
  );
  const r2Key = r2KeyForRendition(mediaId, rendition.driveFileId, kind, index);
  const r2Etag = await uploadR2Stream(
    response.data,
    r2Key,
    "video/mp4",
    rendition.fileSize,
  );
  if (!r2Etag) throw new Error("R2 is not configured for this migration runner.");

  return { ...rendition, r2Key, r2Etag } as typeof rendition;
}

async function main() {
  if (!getR2StorageConfig()) {
    throw new Error("R2 migration requires CLOUDFLARE_R2_* environment variables.");
  }

  const supabase = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"));
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
      .select("id,title,audio_streams")
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
      .select("id,title,audio_streams")
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

  console.log(`R2 migration pass complete. Updated ${migrated} media item(s).`);
}

async function migrateMedia(
  supabase: any,
  drive: any,
  media: { id: string; title: string; audio_streams: unknown },
) {
  const metadata = hlsMetadata(media.audio_streams);
  const originalManifest = metadata?.browserHls;
  if (!metadata || !originalManifest?.video || !Array.isArray(originalManifest.audio)) return false;

  let manifest = originalManifest;
  let changed = false;
  if (!manifest.video.r2Key) {
    manifest = {
      ...manifest,
      video: await migrateRendition(drive, media.id, manifest.video, "video") as HlsManifest["video"],
    };
    await updateManifest(supabase, media.id, metadata, manifest);
    changed = true;
  }

  for (let index = 0; index < manifest.audio.length; index += 1) {
    if (manifest.audio[index].r2Key) continue;
    const audio = await migrateRendition(drive, media.id, manifest.audio[index], "audio", manifest.audio[index].index) as HlsManifest["audio"][number];
    manifest = { ...manifest, audio: manifest.audio.map((item, itemIndex) => itemIndex === index ? audio : item) };
    await updateManifest(supabase, media.id, metadata, manifest);
    changed = true;
  }

  if (changed) {
    console.log(`Migrated ${media.title} (${media.id}) to R2.`);
  }
  return changed;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
