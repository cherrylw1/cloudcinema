import { google, drive_v3 } from "googleapis";
import { env } from "@/config/env";
import { createAdminClient } from "@/clients/supabase/admin";
import type { Database } from "@/types/database";

const VIDEO_MINIMUM_SIZE = 100 * 1024 * 1024;
const SYNC_STATE_ID = "default";

interface SyncSummary {
  scanned: number;
  folders: number;
  videos: number;
  added: number;
  updated: number;
  removed: number;
  skipped: number;
}

type MediaType = "movie" | "tv-show" | "anime";
type PayloadRow = Database["public"]["Tables"]["media_library"]["Insert"];

interface ExistingMeta {
  processing_status: string;
  title: string;
  series: string | null;
  season: number | null;
  episode: number | null;
  media_type: MediaType;
}

interface SyncState {
  root_folder_id: string;
  change_page_token: string;
}

export class DriveSyncService {
  private drive;

  constructor() {
    const oauth2Client = new google.auth.OAuth2(
      env.googleClientId,
      env.googleClientSecret,
      env.googleRedirectUri,
    );

    oauth2Client.setCredentials({
      refresh_token: env.googleRefreshToken,
    });

    this.drive = google.drive({ version: "v3", auth: oauth2Client });
  }

  async sync(options?: {
    full?: boolean;
    modifiedDays?: number;
    pruneMissing?: boolean;
  }): Promise<SyncSummary> {
    const adminClient = createAdminClient();
    const summary: SyncSummary = {
      scanned: 0,
      folders: 0,
      videos: 0,
      added: 0,
      updated: 0,
      removed: 0,
      skipped: 0,
    };
    const startFolderId = await this.resolveStartFolderId();
    const { data: storedState, error: stateError } = await adminClient
      .from("library_sync_state")
      .select("root_folder_id, change_page_token")
      .eq("id", SYNC_STATE_ID)
      .maybeSingle();

    const syncStateAvailable = !stateError;
    if (stateError) {
      console.warn("[Sync] Sync-state table is unavailable; using a full scan for this run.", stateError);
    }

    const syncState = storedState as SyncState | null;
    const canIncrementallySync = Boolean(
      syncState &&
      syncState.root_folder_id === startFolderId &&
      syncState.change_page_token,
    );

    if (syncStateAvailable && options?.full !== true && canIncrementallySync) {
      return this.syncChanges(
        startFolderId,
        syncState!.change_page_token,
        adminClient,
      );
    }

    console.log(`[Sync] Running FULL catalog sync from ${startFolderId}...`);
    const changeStartToken = await this.getStartPageToken();
    const allFiles: drive_v3.Schema$File[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.drive.files.list({
        q: "trashed = false and (mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'video/')",
        fields: "nextPageToken, files(id, name, mimeType, size, parents)",
        pageSize: 1000,
        pageToken,
      });
      const files = response.data.files || [];
      allFiles.push(...files);
      pageToken = response.data.nextPageToken || undefined;
      console.log(`[Sync] Loaded ${allFiles.length} folders and video entries...`);
    } while (pageToken);

    const folderChildrenMap = new Map<string, drive_v3.Schema$File[]>();
    for (const file of allFiles) {
      if (!file.id) continue;
      for (const parentId of file.parents || []) {
        const children = folderChildrenMap.get(parentId) || [];
        children.push(file);
        folderChildrenMap.set(parentId, children);
      }
    }

    const qualifyingVideos: drive_v3.Schema$File[] = [];
    const visitedFolders = new Set<string>();
    const traverse = (folderId: string, currentPath = "/") => {
      if (visitedFolders.has(folderId)) return;
      visitedFolders.add(folderId);
      summary.folders++;

      for (const child of folderChildrenMap.get(folderId) || []) {
        if (child.mimeType === "application/vnd.google-apps.folder" && child.id) {
          const folderName = child.name || "Untitled Folder";
          const nextPath = currentPath === "/" ? `/${folderName}` : `${currentPath}/${folderName}`;
          traverse(child.id, nextPath);
          continue;
        }

        if (child.mimeType?.startsWith("video/")) {
          const fileSize = this.fileSize(child);
          if (fileSize >= VIDEO_MINIMUM_SIZE) {
            (child as drive_v3.Schema$File & { folderPath?: string }).folderPath = currentPath;
            qualifyingVideos.push(child);
            summary.videos++;
          } else {
            summary.skipped++;
          }
        } else {
          summary.skipped++;
        }
      }
    };

    traverse(startFolderId);

    if (options?.pruneMissing) {
      const currentDriveIds = new Set(
        qualifyingVideos.map((video) => video.id).filter((id): id is string => Boolean(id)),
      );
      summary.removed = await this.removeMissingFiles(adminClient, currentDriveIds);
    }

    await this.upsertFiles(adminClient, qualifyingVideos, summary);
    if (syncStateAvailable) {
      await this.saveSyncState(adminClient, startFolderId, changeStartToken, true);
    }
    summary.scanned = summary.folders + summary.videos + summary.skipped;
    console.log(`[Sync] Full synchronization completed successfully.`);
    return summary;
  }

  private async syncChanges(
    rootFolderId: string,
    pageToken: string,
    adminClient: ReturnType<typeof createAdminClient>,
  ): Promise<SyncSummary> {
    const summary: SyncSummary = {
      scanned: 0,
      folders: 0,
      videos: 0,
      added: 0,
      updated: 0,
      removed: 0,
      skipped: 0,
    };
    const changedFiles: drive_v3.Schema$File[] = [];
    const removedIds = new Set<string>();
    let nextPageToken: string | undefined = pageToken;
    let newStartPageToken: string | undefined;
    let folderChanged = false;

    try {
      do {
        const response = await this.drive.changes.list({
          pageToken: nextPageToken,
          spaces: "drive",
          pageSize: 1000,
          fields: "nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,mimeType,size,parents,trashed))",
        }) as unknown as {
          data: {
            nextPageToken?: string | null;
            newStartPageToken?: string | null;
            changes?: Array<{
              fileId?: string | null;
              removed?: boolean | null;
              file?: drive_v3.Schema$File | null;
            }>;
          };
        };

        for (const change of response.data.changes || []) {
          const fileId = change.fileId;
          const file = change.file;
          if (!fileId) continue;
          if (file?.mimeType === "application/vnd.google-apps.folder") {
            folderChanged = true;
            continue;
          }
          if (change.removed || !file || file.trashed) {
            removedIds.add(fileId);
          } else {
            changedFiles.push(file);
          }
        }

        nextPageToken = response.data.nextPageToken || undefined;
        newStartPageToken = response.data.newStartPageToken || newStartPageToken;
      } while (nextPageToken);
    } catch (error: unknown) {
      const status = (error as { code?: number; response?: { status?: number } })?.response?.status
        ?? (error as { code?: number })?.code;
      if (status === 410) {
        console.warn("[Sync] Drive change token expired; rebuilding the catalog.");
        return this.sync({ full: true, pruneMissing: true });
      }
      throw error;
    }

    // A folder move can change the path of many children without emitting one
    // useful file record per child, so a repair scan is the safe fallback.
    if (folderChanged) {
      console.log("[Sync] Folder structure changed; running a repair scan.");
      return this.sync({ full: true, pruneMissing: true });
    }

    const folderPathCache = new Map<string, string>();
    const rootMembershipCache = new Map<string, boolean>();
    const qualifyingVideos: drive_v3.Schema$File[] = [];

    for (const file of changedFiles) {
      const fileId = file.id;
      if (!fileId || !file.mimeType?.startsWith("video/")) {
        if (fileId) removedIds.add(fileId);
        summary.skipped++;
        continue;
      }

      const parentId = await this.findRootParent(
        file.parents || [],
        rootFolderId,
        rootMembershipCache,
      );
      const fileSize = this.fileSize(file);
      if (!parentId || fileSize < VIDEO_MINIMUM_SIZE) {
        removedIds.add(fileId);
        summary.skipped++;
        continue;
      }

      (file as drive_v3.Schema$File & { folderPath?: string }).folderPath =
        await this.resolveFolderPath(parentId, folderPathCache, rootFolderId);
      qualifyingVideos.push(file);
      summary.videos++;
      removedIds.delete(fileId);
    }

    summary.removed = await this.removeByDriveIds(adminClient, removedIds);
    await this.upsertFiles(adminClient, qualifyingVideos, summary);

    if (!newStartPageToken) {
      newStartPageToken = pageToken;
    }
    await this.saveSyncState(adminClient, rootFolderId, newStartPageToken, false);
    summary.scanned = changedFiles.length + removedIds.size;
    console.log(`[Sync] Incremental synchronization completed: ${summary.videos} changed videos.`);
    return summary;
  }

  private async resolveStartFolderId() {
    const configuredRoot = env.googleDriveFolderId || "root";
    if (configuredRoot !== "root") return configuredRoot;

    try {
      const rootMeta = await this.drive.files.get({ fileId: "root", fields: "id" });
      return rootMeta.data.id || "root";
    } catch (error) {
      console.warn("[Sync] Failed to resolve root ID alias; using 'root'.", error);
      return "root";
    }
  }

  private async getStartPageToken() {
    const response = await this.drive.changes.getStartPageToken() as unknown as {
      data: { startPageToken?: string | null };
    };
    if (!response.data.startPageToken) {
      throw new Error("Google Drive did not return a change page token.");
    }
    return response.data.startPageToken;
  }

  private async saveSyncState(
    adminClient: ReturnType<typeof createAdminClient>,
    rootFolderId: string,
    changePageToken: string,
    fullSync: boolean,
  ) {
    const { error } = await adminClient
      .from("library_sync_state")
      .upsert({
        id: SYNC_STATE_ID,
        root_folder_id: rootFolderId,
        change_page_token: changePageToken,
        ...(fullSync ? { last_full_sync_at: new Date().toISOString() } : {}),
      }, { onConflict: "id" });
    if (error) throw error;
  }

  private async resolveFolderPath(
    parentId: string,
    folderCacheMap: Map<string, string>,
    rootFolderId: string,
  ): Promise<string> {
    if (parentId === rootFolderId || (rootFolderId === "root" && parentId === "root")) return "/";
    if (folderCacheMap.has(parentId)) return folderCacheMap.get(parentId)!;

    try {
      const response = await this.drive.files.get({
        fileId: parentId,
        fields: "name,parents",
      });
      const name = response.data.name || "Untitled Folder";
      const nextParentId = response.data.parents?.[0];
      const parentPath = nextParentId
        ? await this.resolveFolderPath(nextParentId, folderCacheMap, rootFolderId)
        : "/";
      const currentPath = parentPath === "/" ? `/${name}` : `${parentPath}/${name}`;
      folderCacheMap.set(parentId, currentPath);
      return currentPath;
    } catch (error) {
      console.warn(`[Sync] Failed to resolve folder path for ${parentId}.`, error);
      return "/";
    }
  }

  private async findRootParent(
    parentIds: string[],
    rootFolderId: string,
    cache: Map<string, boolean>,
  ): Promise<string | null> {
    for (const parentId of parentIds) {
      if (await this.isInsideRoot(parentId, rootFolderId, cache)) return parentId;
    }
    return null;
  }

  private async isInsideRoot(
    folderId: string,
    rootFolderId: string,
    cache: Map<string, boolean>,
  ): Promise<boolean> {
    if (folderId === rootFolderId || (rootFolderId === "root" && folderId === "root")) return true;
    if (cache.has(folderId)) return cache.get(folderId)!;

    try {
      const response = await this.drive.files.get({ fileId: folderId, fields: "parents" });
      const parents = response.data.parents || [];
      for (const parentId of parents) {
        if (parentId !== folderId && await this.isInsideRoot(parentId, rootFolderId, cache)) {
          cache.set(folderId, true);
          return true;
        }
      }
      cache.set(folderId, false);
      return false;
    } catch {
      cache.set(folderId, false);
      return false;
    }
  }

  private fileSize(file: drive_v3.Schema$File) {
    return file.size ? Number(file.size) : 0;
  }

  private async upsertFiles(
    adminClient: ReturnType<typeof createAdminClient>,
    files: drive_v3.Schema$File[],
    summary: SyncSummary,
  ) {
    if (files.length === 0) return;

    const fileIds = files.map((file) => file.id).filter((id): id is string => Boolean(id));
    const existingIds = new Set<string>();
    const existingMetadata = new Map<string, ExistingMeta>();

    for (let index = 0; index < fileIds.length; index += 500) {
      const { data, error } = await adminClient
        .from("media_library")
        .select("drive_file_id, processing_status, title, series, season, episode, media_type")
        .in("drive_file_id", fileIds.slice(index, index + 500));
      if (error) throw error;
      for (const row of data || []) {
        existingIds.add(row.drive_file_id);
        existingMetadata.set(row.drive_file_id, {
          processing_status: row.processing_status || "none",
          title: row.title,
          series: row.series,
          season: row.season,
          episode: row.episode,
          media_type: row.media_type as MediaType,
        });
      }
    }

    const payload: PayloadRow[] = [];
    for (const file of files) {
      if (!file.id) continue;
      const existing = existingMetadata.get(file.id);
      const name = file.name || "Untitled File";
      const extensionIndex = name.lastIndexOf(".");
      const parsedTitle = extensionIndex > 0 ? name.slice(0, extensionIndex) : name;
      const episodeMatch = name.match(/s(\d{1,2})e(\d{1,3})/i);
      const inferredSeries = episodeMatch
        ? name.slice(0, episodeMatch.index).trim().replace(/[-_\.\s]+$/, "") || "Unknown Series"
        : null;
      const inferredType: MediaType = episodeMatch ? "tv-show" : "movie";

      if (existing) summary.updated++;
      else summary.added++;

      payload.push({
        drive_file_id: file.id,
        title: existing?.title || parsedTitle,
        series: existing?.series ?? inferredSeries,
        season: existing?.season ?? (episodeMatch ? Number(episodeMatch[1]) : null),
        episode: existing?.episode ?? (episodeMatch ? Number(episodeMatch[2]) : null),
        media_type: existing?.media_type || inferredType,
        file_size: this.fileSize(file) || null,
        mime_type: file.mimeType || null,
        processing_status: existing?.processing_status || "none",
        folder_path: (file as drive_v3.Schema$File & { folderPath?: string }).folderPath || "/",
      });
    }

    const chunks: PayloadRow[][] = [];
    for (let index = 0; index < payload.length; index += 500) {
      chunks.push(payload.slice(index, index + 500));
    }
    await Promise.all(chunks.map(async (chunk) => {
      const { error } = await adminClient
        .from("media_library")
        .upsert(chunk, { onConflict: "drive_file_id" });
      if (error) throw error;
    }));
  }

  private async removeMissingFiles(
    adminClient: ReturnType<typeof createAdminClient>,
    currentDriveIds: Set<string>,
  ) {
    const staleIds: string[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await adminClient
        .from("media_library")
        .select("id, drive_file_id")
        .range(from, from + 999);
      if (error) throw error;
      for (const row of data || []) {
        if (!currentDriveIds.has(row.drive_file_id)) staleIds.push(row.id);
      }
      if (!data || data.length < 1000) break;
    }

    for (let index = 0; index < staleIds.length; index += 500) {
      const { error } = await adminClient
        .from("media_library")
        .delete()
        .in("id", staleIds.slice(index, index + 500));
      if (error) throw error;
    }
    return staleIds.length;
  }

  private async removeByDriveIds(
    adminClient: ReturnType<typeof createAdminClient>,
    driveIds: Set<string>,
  ) {
    if (driveIds.size === 0) return 0;
    const ids = Array.from(driveIds);
    const { error } = await adminClient
      .from("media_library")
      .delete()
      .in("drive_file_id", ids);
    if (error) throw error;
    return ids.length;
  }
}
