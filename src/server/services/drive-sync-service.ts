import { google } from "googleapis";
import { env } from "@/config/env";
import { createAdminClient } from "@/clients/supabase/admin";

interface SyncSummary {
  scanned: number;
  added: number;
  updated: number;
  skipped: number;
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
    const summary: SyncSummary = { scanned: 0, added: 0, updated: 0, skipped: 0 };
    const adminClient = createAdminClient();

    // Recursive traverser helper
    const traverse = async (folderId: string) => {
      let pageToken: string | undefined = undefined;

      do {
        const response: any = await this.drive.files.list({
          q: `'${folderId}' in parents and trashed = false`,
          fields: "nextPageToken, files(id, name, mimeType, size)",
          pageSize: 100,
          pageToken: pageToken,
        });

        const files = response.data.files || [];
        pageToken = response.data.nextPageToken || undefined;

        for (const file of files) {
          if (!file.id || !file.name || !file.mimeType) {
            continue;
          }

          summary.scanned++;

          if (file.mimeType === "application/vnd.google-apps.folder") {
            // Recurse into subfolder
            await traverse(file.id);
          } else if (file.mimeType.startsWith("video/")) {
            // Process video file
            const name = file.name;
            const extensionIndex = name.lastIndexOf(".");
            const title = extensionIndex !== -1 ? name.substring(0, extensionIndex) : name;

            // SxxExx pattern matching (e.g. S01E02)
            const match = name.match(/s(\d{1,2})e(\d{1,3})/i);

            let mediaType: "movie" | "tv-show" | "anime" = "movie";
            let series: string | null = null;
            let season: number | null = null;
            let episode: number | null = null;

            if (match) {
              mediaType = "tv-show";
              season = parseInt(match[1], 10);
              episode = parseInt(match[2], 10);

              // Extract series name from the part before SxxExx
              const prefix = name.substring(0, match.index).trim();
              // Clean up trailing dots, dashes, underscores, and spaces
              series = prefix.replace(/[-_\.\s]+$/, "").trim();
              if (!series) {
                series = "Unknown Series";
              }
            }

            const fileSize = file.size ? parseInt(file.size, 10) : null;

            // Check if record already exists in database to count added vs updated
            const { data: existing, error: selectError } = await adminClient
              .from("media_library")
              .select("id")
              .eq("drive_file_id", file.id)
              .maybeSingle();

            if (selectError) {
              throw selectError;
            }

            const { error: upsertError } = await adminClient
              .from("media_library")
              .upsert(
                {
                  drive_file_id: file.id,
                  title: title,
                  series: series,
                  season: season,
                  episode: episode,
                  media_type: mediaType,
                  file_size: fileSize,
                },
                { onConflict: "drive_file_id" }
              );

            if (upsertError) {
              throw upsertError;
            }

            if (existing) {
              summary.updated++;
            } else {
              summary.added++;
            }
          } else {
            // Non-video files are skipped
            summary.skipped++;
          }
        }
      } while (pageToken);
    };

    await traverse(rootFolderId);
    return summary;
  }
}
