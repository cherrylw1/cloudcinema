import { google, drive_v3 } from "googleapis";
import { env } from "@/config/env";
import { createAdminClient } from "@/clients/supabase/admin";
import type { Database } from "@/types/database";
import { probeMetadata } from "@/server/services/metadata-probe-service";

interface SyncSummary {
  scanned: number;    // Total elements processed (folders + files)
  folders: number;    // Total folders traversed
  videos: number;     // Total video files processed
  added: number;      // New videos added to catalog
  updated: number;    // Existing videos updated
  skipped: number;    // Non-video files skipped
}

export class DriveSyncService {
  private auth;
  private drive;

  constructor() {
    const oauth2Client = new google.auth.OAuth2(
      env.googleClientId,
      env.googleClientSecret,
      env.googleRedirectUri
    );

    oauth2Client.setCredentials({
      refresh_token: env.googleRefreshToken,
    });

    this.auth = oauth2Client;
    this.drive = google.drive({ version: "v3", auth: oauth2Client });
  }

  async sync(): Promise<SyncSummary> {
    const rootFolderId = env.googleDriveFolderId || "root";
    const summary: SyncSummary = { scanned: 0, folders: 0, videos: 0, added: 0, updated: 0, skipped: 0 };
    const adminClient = createAdminClient();

    console.log(`[Sync] Resolving start folder ID for: ${rootFolderId}`);
    let startFolderId = rootFolderId;
    if (rootFolderId === "root") {
      try {
        const rootMeta = (await this.drive.files.get({ fileId: "root", fields: "id" })) as unknown as { data: drive_v3.Schema$File };
        if (rootMeta.data.id) {
          startFolderId = rootMeta.data.id;
          console.log(`[Sync] Resolved root alias to true ID: ${startFolderId}`);
        }
      } catch (err) {
        console.warn("[Sync] Failed to resolve root ID alias, falling back to 'root'", err);
      }
    }

    console.log(`[Sync] Fetching file catalog list from Google Drive...`);
    const allFiles: drive_v3.Schema$File[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const response = (await this.drive.files.list({
        q: "trashed = false",
        fields: "nextPageToken, files(id, name, mimeType, size, parents)",
        pageSize: 1000,
        pageToken: pageToken,
      })) as unknown as { data: { files?: drive_v3.Schema$File[]; nextPageToken?: string | null } };

      const files = response.data.files || [];
      allFiles.push(...files);
      pageToken = response.data.nextPageToken || undefined;
      console.log(`[Sync] Loaded ${allFiles.length} file metadata entries...`);
    } while (pageToken);

    console.log(`[Sync] Building parent-child folder tree in memory...`);
    const folderChildrenMap = new Map<string, drive_v3.Schema$File[]>();

    for (const file of allFiles) {
      if (!file.id) continue;
      const parents = file.parents || [];
      for (const parentId of parents) {
        if (!folderChildrenMap.has(parentId)) {
          folderChildrenMap.set(parentId, []);
        }
        folderChildrenMap.get(parentId)!.push(file);
      }
    }

    console.log(`[Sync] Performing depth-first traversal from: ${startFolderId}`);
    const visitedFolders = new Set<string>();
    const qualifyingVideos: drive_v3.Schema$File[] = [];

    const traverse = (folderId: string) => {
      if (visitedFolders.has(folderId)) return;
      visitedFolders.add(folderId);
      summary.folders++;

      const children = folderChildrenMap.get(folderId) || [];
      for (const child of children) {
        if (child.mimeType === "application/vnd.google-apps.folder" && child.id) {
          traverse(child.id);
        } else if (child.mimeType && child.mimeType.startsWith("video/")) {
          summary.videos++;
          qualifyingVideos.push(child);
        } else {
          summary.skipped++;
        }
      }
    };

    // Run in-memory tree traversal
    traverse(startFolderId);

    console.log(`[Sync] Traversal complete. Folders: ${summary.folders}, Videos: ${summary.videos}, Skipped: ${summary.skipped}`);

    if (qualifyingVideos.length === 0) {
      summary.scanned = summary.folders + summary.videos + summary.skipped;
      return summary;
    }

    console.log(`[Sync] Querying existing DB records to identify additions/updates...`);
    const driveFileIds = qualifyingVideos.map((v) => v.id);
    const existingFileIdsSet = new Set<string>();
    const existingFileMetadataMap = new Map<string, { dv_profile: number | null; audio_codec: string | null }>();

    const dbChunkSize = 100;
    for (let i = 0; i < driveFileIds.length; i += dbChunkSize) {
      const chunk = driveFileIds.slice(i, i + dbChunkSize);
      const { data: existingList, error } = await adminClient
        .from("media_library")
        .select("drive_file_id, dv_profile, audio_codec")
        .in("drive_file_id", chunk);

      if (error) throw error;
      if (existingList) {
        for (const row of existingList) {
          existingFileIdsSet.add(row.drive_file_id);
          existingFileMetadataMap.set(row.drive_file_id, {
            dv_profile: row.dv_profile,
            audio_codec: row.audio_codec,
          });
        }
      }
    }

    console.log(`[Sync] Requesting Google Drive access token for metadata probing...`);
    const tokenInfo = await this.auth.getAccessToken();
    const accessToken = tokenInfo.token;
    if (!accessToken) {
      throw new Error("[Sync] Failed to retrieve Google Drive OAuth access token for probing.");
    }

    console.log(`[Sync] Preparing catalog payload...`);

    // Phase 1: Build full payload and identify which files need probing
    type PayloadRow = Database["public"]["Tables"]["media_library"]["Insert"];
    const upsertPayload: PayloadRow[] = [];
    const filesToProbe: Array<{ fileId: string; payloadIndex: number }> = [];

    for (const file of qualifyingVideos) {
      if (!file.id) continue;
      const name = file.name || "Untitled File";
      const extensionIndex = name.lastIndexOf(".");
      const title = extensionIndex !== -1 ? name.substring(0, extensionIndex) : name;

      const match = name.match(/s(\d{1,2})e(\d{1,3})/i);

      let mediaType: "movie" | "tv-show" | "anime" = "movie";
      let series: string | null = null;
      let season: number | null = null;
      let episode: number | null = null;

      if (match) {
        mediaType = "tv-show";
        season = parseInt(match[1], 10);
        episode = parseInt(match[2], 10);

        const prefix = name.substring(0, match.index).trim();
        series = prefix.replace(/[-_\.\s]+$/, "").trim();
        if (!series) {
          series = "Unknown Series";
        }
      }

      const fileSize = file.size ? parseInt(file.size, 10) : null;
      const isExisting = existingFileIdsSet.has(file.id);
      const meta = existingFileMetadataMap.get(file.id);

      if (isExisting) {
        summary.updated++;
      } else {
        summary.added++;
      }

      // Use cached metadata if already probed; otherwise queue for probing
      let dvProfile: number | null = null;
      let audioCodec: string | null = null;
      const alreadyProbed = meta && (meta.audio_codec !== null || meta.dv_profile !== null);
      if (alreadyProbed) {
        dvProfile = meta!.dv_profile;
        audioCodec = meta!.audio_codec;
      }

      const payloadIndex = upsertPayload.length;
      upsertPayload.push({
        drive_file_id: file.id,
        title,
        series,
        season,
        episode,
        media_type: mediaType,
        file_size: fileSize,
        mime_type: file.mimeType || null,
        dv_profile: dvProfile,
        audio_codec: audioCodec,
      });

      if (!alreadyProbed) {
        filesToProbe.push({ fileId: file.id, payloadIndex });
      }
    }

    // Phase 2: Run all outstanding probes concurrently in batches of 10
    const PROBE_CONCURRENCY = 10;
    console.log(`[Sync] Probing ${filesToProbe.length} files for metadata (concurrency=${PROBE_CONCURRENCY})...`);
    for (let i = 0; i < filesToProbe.length; i += PROBE_CONCURRENCY) {
      const batch = filesToProbe.slice(i, i + PROBE_CONCURRENCY);
      await Promise.all(
        batch.map(async ({ fileId, payloadIndex }) => {
          try {
            const result = await probeMetadata(fileId, accessToken);
            upsertPayload[payloadIndex].dv_profile = result.dvProfile;
            upsertPayload[payloadIndex].audio_codec = result.audioCodec;
          } catch (err) {
            console.error(`[Sync] Probe failed for ${fileId}:`, err);
          }
        })
      );
    }
    console.log(`[Sync] Probe phase complete. ${filesToProbe.length} files processed.`);

    console.log(`[Sync] Upserting ${upsertPayload.length} media records in batches of 100...`);
    const upsertChunkSize = 100;
    for (let i = 0; i < upsertPayload.length; i += upsertChunkSize) {
      const chunk = upsertPayload.slice(i, i + upsertChunkSize);
      const { error } = await adminClient
        .from("media_library")
        .upsert(chunk, { onConflict: "drive_file_id" });

      if (error) throw error;
    }

    // Set self-consistent scanned sum
    summary.scanned = summary.folders + summary.added + summary.updated + summary.skipped;
    console.log(`[Sync] Synchronization completed successfully.`);
    return summary;
  }
}
