import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import type { drive_v3 } from "googleapis";
import type { HlsManifest } from "../src/repositories/media";
import { r2KeyForRendition, uploadR2File } from "../src/server/r2-storage";

interface MediaSource {
  input: string;
  headers?: string;
  streamIndex: number;
}

interface AudioSource extends MediaSource {
  index: number;
  language: string;
  label: string;
  channels: number;
  default: boolean;
}

interface PackageOptions {
  mediaId: string;
  title: string;
  video: MediaSource & {
    width: number | null;
    height: number | null;
    bandwidth: number;
  };
  audio: AudioSource[];
  drive: drive_v3.Drive;
  parentFolderId: string;
}

function inputArgs(source: MediaSource) {
  const args: string[] = ["-y"];
  if (source.headers) args.push("-headers", source.headers);
  args.push("-i", source.input);
  return args;
}

function hlsArgs(mediaFilename: string) {
  return [
    "-f", "hls",
    "-hls_time", "10",
    "-hls_playlist_type", "vod",
    "-hls_segment_type", "fmp4",
    "-hls_flags", "single_file+independent_segments",
    "-hls_segment_filename", mediaFilename,
  ];
}

async function upload(
  drive: drive_v3.Drive,
  parentFolderId: string,
  localPath: string,
  remoteName: string,
) {
  const result = await drive.files.create({
    requestBody: {
      name: remoteName,
      parents: [parentFolderId],
      mimeType: "video/mp4",
    },
    media: { body: fs.createReadStream(localPath) },
    fields: "id,size",
  });

  const driveFileId = result.data.id as string | undefined;
  if (!driveFileId) throw new Error(`Failed to upload ${remoteName}.`);

  const localSize = fs.statSync(localPath).size;
  return {
    driveFileId,
    fileSize: result.data.size ? Number(result.data.size) : localSize,
  };
}

async function uploadBrowserRenditionToR2(
  mediaId: string,
  driveFileId: string,
  localPath: string,
  kind: "video" | "audio",
  index?: number,
) {
  const fileSize = fs.statSync(localPath).size;
  const r2Key = r2KeyForRendition(mediaId, driveFileId, kind, index);
  try {
    const r2Etag = await uploadR2File(localPath, r2Key, "video/mp4", fileSize);
    return r2Etag ? { r2Key, r2Etag } : {};
  } catch (error) {
    console.warn(`[HLS] R2 upload skipped for ${r2Key}:`, error);
    return {};
  }
}

export async function packageBrowserHls(options: PackageOptions): Promise<HlsManifest> {
  const workDir = fs.mkdtempSync(path.join(process.cwd(), `.hls-${options.mediaId}-`));
  const videoMedia = path.join(workDir, "video.mp4");
  const videoPlaylist = path.join(workDir, "video.m3u8");

  try {
    execFileSync("ffmpeg", [
      ...inputArgs(options.video),
      "-map", `0:v:${options.video.streamIndex}`,
      "-an",
      "-c:v", "copy",
      ...hlsArgs(videoMedia),
      videoPlaylist,
    ], { stdio: "inherit" });

    const uploadedVideo = await upload(
      options.drive,
      options.parentFolderId,
      videoMedia,
      `${options.title} [browser HLS video].mp4`,
    );
    const uploadedVideoR2 = await uploadBrowserRenditionToR2(
      options.mediaId,
      uploadedVideo.driveFileId,
      videoMedia,
      "video",
    );

    const audio: HlsManifest["audio"] = [];
    for (const track of options.audio) {
      const audioMedia = path.join(workDir, `audio-${track.index}.mp4`);
      const audioPlaylist = path.join(workDir, `audio-${track.index}.m3u8`);
      const channels = Math.max(1, Math.min(track.channels || 2, 6));
      const bitrate = channels > 2 ? "384k" : "192k";

      execFileSync("ffmpeg", [
        ...inputArgs(track),
        "-map", `0:a:${track.streamIndex}`,
        "-vn",
        "-c:a", "aac",
        "-ac", String(channels),
        "-b:a", bitrate,
        ...hlsArgs(audioMedia),
        audioPlaylist,
      ], { stdio: "inherit" });

      const uploadedAudio = await upload(
        options.drive,
        options.parentFolderId,
        audioMedia,
        `${options.title} [browser HLS audio ${track.index} - ${track.language}].mp4`,
      );
      const uploadedAudioR2 = await uploadBrowserRenditionToR2(
        options.mediaId,
        uploadedAudio.driveFileId,
        audioMedia,
        "audio",
        track.index,
      );

      audio.push({
        ...uploadedAudio,
        ...uploadedAudioR2,
        index: track.index,
        language: track.language,
        label: track.label,
        channels,
        default: track.default,
        playlist: fs.readFileSync(audioPlaylist, "utf8"),
      });
    }

    return {
      version: 1,
      video: {
        ...uploadedVideo,
        ...uploadedVideoR2,
        playlist: fs.readFileSync(videoPlaylist, "utf8"),
        codec: "avc1.640028",
        width: options.video.width,
        height: options.video.height,
        bandwidth: Math.max(options.video.bandwidth, 2_000_000),
      },
      audio,
    };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}
