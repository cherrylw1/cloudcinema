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

  private async resolveFolderPath(
    parentId: string | undefined,
    folderCacheMap: Map<string, string>,
    rootFolderId: string
  ): Promise<string> {
    if (!parentId || parentId === rootFolderId || parentId === "root") {
      return "/";
    }

    if (folderCacheMap.has(parentId)) {
      return folderCacheMap.get(parentId)!;
    }

    try {
      const res = (await this.drive.files.get({
        fileId: parentId,
        fields: "name, parents",
      })) as unknown as { data: { name?: string; parents?: string[] } };

      const name = res.data.name || "Untitled Folder";
      const nextParentId = res.data.parents?.[0];

      const parentPath = await this.resolveFolderPath(nextParentId, folderCacheMap, rootFolderId);
      const currentPath = parentPath === "/" ? `/${name}` : `${parentPath}/${name}`;

      folderCacheMap.set(parentId, currentPath);
      return currentPath;
    } catch (err) {
      console.warn(`[Sync] Failed to resolve parent folder path for ID ${parentId}, falling back to '/'`, err);
      return "/";
    }
  }

  async sync(options?: { full?: boolean; modifiedDays?: number }): Promise<SyncSummary> {
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

    // Determine sync mode (Full vs Incremental)
    let isFullSync = options?.full === true;
    if (!isFullSync) {
      // Check if DB has any existing records
      const { count } = await adminClient
        .from("media_library")
        .select("id", { count: "exact", head: true });
      
      if (!count || count === 0) {
        console.log("[Sync] Database is empty. Defaulting to full catalog sync.");
        isFullSync = true;
      }
    }

    const qualifyingVideos: drive_v3.Schema$File[] = [];

    if (isFullSync) {
      console.log(`[Sync] Running FULL catalog sync tree traversal...`);
      console.log(`[Sync] Fetching file catalog list from Google Drive...`);
      const allFiles: drive_v3.Schema$File[] = [];
      let pageToken: string | undefined = undefined;

      do {
        const response = (await this.drive.files.list({
          q: "trashed = false and (mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'video/')",
          fields: "nextPageToken, files(id, name, mimeType, size, parents)",
          pageSize: 1000,
          pageToken: pageToken,
        })) as unknown as { data: { files?: drive_v3.Schema$File[]; nextPageToken?: string | null } };

        const files = response.data.files || [];
        allFiles.push(...files);
        pageToken = response.data.nextPageToken || undefined;
        console.log(`[Sync] Loaded ${allFiles.length} folders and video entries...`);
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

      const traverse = (folderId: string, currentPath: string = "/") => {
        if (visitedFolders.has(folderId)) return;
        visitedFolders.add(folderId);
        summary.folders++;

        const children = folderChildrenMap.get(folderId) || [];
        for (const child of children) {
          if (child.mimeType === "application/vnd.google-apps.folder" && child.id) {
            const folderName = child.name || "Untitled Folder";
            const nextPath = currentPath === "/" ? `/${folderName}` : `${currentPath}/${folderName}`;
            traverse(child.id, nextPath);
          } else if (child.mimeType && child.mimeType.startsWith("video/")) {
            const fileSize = child.size ? parseInt(child.size, 10) : 0;
            if (fileSize >= 100 * 1024 * 1024) {
              summary.videos++;
              (child as any).folderPath = currentPath;
              qualifyingVideos.push(child);
            } else {
              summary.skipped++;
            }
          } else {
            summary.skipped++;
          }
        }
      };

      traverse(startFolderId, "/");
      console.log(`[Sync] Traversal complete. Folders: ${summary.folders}, Videos: ${summary.videos}, Skipped: ${summary.skipped}`);
    } else {
      const days = options?.modifiedDays || 7;
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      console.log(`[Sync] Running INCREMENTAL catalog sync (modified since ${sinceDate})...`);

      const allFiles: drive_v3.Schema$File[] = [];
      let pageToken: string | undefined = undefined;

      do {
        const response = (await this.drive.files.list({
          q: `trashed = false and mimeType contains 'video/' and modifiedTime > '${sinceDate}'`,
          fields: "nextPageToken, files(id, name, mimeType, size, parents)",
          pageSize: 100,
          pageToken: pageToken,
        })) as unknown as { data: { files?: drive_v3.Schema$File[]; nextPageToken?: string | null } };

        const files = response.data.files || [];
        allFiles.push(...files);
        pageToken = response.data.nextPageToken || undefined;
      } while (pageToken);

      console.log(`[Sync] Loaded ${allFiles.length} recently modified folders/video entries.`);

      const folderCacheMap = new Map<string, string>();
      for (const file of allFiles) {
        if (file.mimeType && file.mimeType.startsWith("video/")) {
          const fileSize = file.size ? parseInt(file.size, 10) : 0;
          if (fileSize >= 100 * 1024 * 1024) {
            summary.videos++;
            // Resolve its parent path recursively
            const parentId = file.parents?.[0];
            const resolvedPath = await this.resolveFolderPath(parentId, folderCacheMap, startFolderId);
            (file as any).folderPath = resolvedPath;
            qualifyingVideos.push(file);
          } else {
            summary.skipped++;
          }
        } else {
          // Track folders scanned
          if (file.mimeType === "application/vnd.google-apps.folder") {
            summary.folders++;
          } else {
            summary.skipped++;
          }
        }
      }
    }

    if (qualifyingVideos.length === 0) {
      summary.scanned = summary.folders + summary.videos + summary.skipped;
      return summary;
    }

    console.log(`[Sync] Querying existing DB records to identify additions/updates...`);
    const driveFileIds = qualifyingVideos.map((v) => v.id);
    const existingFileIdsSet = new Set<string>();
    interface ExistingMeta {
      processing_status: string;
      title: string;
      series: string | null;
      season: number | null;
      episode: number | null;
      media_type: "movie" | "tv-show" | "anime";
    }
    const existingFileMetadataMap = new Map<string, ExistingMeta>();

    const dbChunkSize = 100;
    for (let i = 0; i < driveFileIds.length; i += dbChunkSize) {
      const chunk = driveFileIds.slice(i, i + dbChunkSize);
      const { data: existingList, error } = await adminClient
        .from("media_library")
        .select("drive_file_id, processing_status, title, series, season, episode, media_type")
        .in("drive_file_id", chunk);

      if (error) throw error;
      if (existingList) {
        for (const row of existingList) {
          existingFileIdsSet.add(row.drive_file_id);
          existingFileMetadataMap.set(row.drive_file_id, {
            processing_status: row.processing_status || "none",
            title: row.title,
            series: row.series,
            season: row.season,
            episode: row.episode,
            media_type: row.media_type as "movie" | "tv-show" | "anime",
          });
        }
      }
    }

    console.log(`[Sync] Preparing catalog payload...`);
    type PayloadRow = Database["public"]["Tables"]["media_library"]["Insert"];
    const upsertPayload: PayloadRow[] = [];

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

      const processingStatus = meta ? meta.processing_status : "none";
      const dbTitle = meta ? meta.title : title;
      const dbSeries = meta ? meta.series : series;
      const dbSeason = meta ? meta.season : season;
      const dbEpisode = meta ? meta.episode : episode;
      const dbMediaType = meta ? meta.media_type : mediaType;

      upsertPayload.push({
        drive_file_id: file.id,
        title: dbTitle,
        series: dbSeries,
        season: dbSeason,
        episode: dbEpisode,
        media_type: dbMediaType,
        file_size: fileSize,
        mime_type: file.mimeType || null,
        processing_status: processingStatus,
        folder_path: (file as any).folderPath || "/",
      });
    }

    console.log(`[Sync] Upserting ${upsertPayload.length} media records in batches of 500...`);
    const upsertChunkSize = 500;
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
