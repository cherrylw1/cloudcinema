import { google, drive_v3 } from "googleapis";
import { env } from "@/config/env";
import { createAdminClient } from "@/clients/supabase/admin";
import type { Database } from "@/types/database";

interface SyncSummary {
  scanned: number;    // Total elements processed (folders + files)
  folders: number;    // Total folders traversed
  videos: number;     // Total video files processed
  added: number;      // New videos added to catalog
  updated: number;    // Existing videos updated
  skipped: number;    // Non-video files skipped
}

export class DriveSyncService {
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

    const dbChunkSize = 100;
    for (let i = 0; i < driveFileIds.length; i += dbChunkSize) {
      const chunk = driveFileIds.slice(i, i + dbChunkSize);
      const { data: existingList, error } = await adminClient
        .from("media_library")
        .select("drive_file_id")
        .in("drive_file_id", chunk);

      if (error) throw error;
      if (existingList) {
        for (const row of existingList) {
          existingFileIdsSet.add(row.drive_file_id);
        }
      }
    }

    console.log(`[Sync] Preparing catalog payload...`);
    const upsertPayload: Database["public"]["Tables"]["media_library"]["Insert"][] = [];

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

      if (isExisting) {
        summary.updated++;
      } else {
        summary.added++;
      }

      upsertPayload.push({
        drive_file_id: file.id,
        title: title,
        series: series,
        season: season,
        episode: episode,
        media_type: mediaType,
        file_size: fileSize,
        mime_type: file.mimeType || null,
      });
    }

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
