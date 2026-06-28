/* eslint-disable @typescript-eslint/no-explicit-any */
import { spawn } from "child_process";
import fs from "fs";
// ffprobe-static is a proper npm package — Vercel bundles it correctly,
// including the platform-appropriate binary inside node_modules.
import ffprobeStatic from "ffprobe-static";
import type { AudioStream, SubtitleStream } from "@/repositories/media";

// Only text-based subtitle codecs can be converted to WebVTT by ffmpeg.
// Image-based codecs (hdmv_pgs_subtitle, dvd_subtitle, dvb_subtitle) are excluded.
const TEXT_SUBTITLE_CODECS = new Set([
  "subrip", "srt", "webvtt", "ass", "ssa", "mov_text", "text", "microdvd", "jacosub",
]);

export type { AudioStream, SubtitleStream };

export interface ProbeResult {
  dvProfile: number | null;
  audioCodec: string | null;       // first audio track codec (backward compat)
  videoCodec: string | null;
  audioStreams: AudioStream[];      // all audio tracks
  subtitleStreams: SubtitleStream[]; // text-based subtitle tracks only
}

const NULL_RESULT: ProbeResult = {
  dvProfile: null,
  audioCodec: null,
  videoCodec: null,
  audioStreams: [],
  subtitleStreams: [],
};

/**
 * Runs ffprobe on a remote Google Drive media file using OAuth2 bearer authentication.
 * Returns Dolby Vision profile, primary codec info, and all audio/subtitle stream metadata.
 */
export function probeMetadata(fileId: string, accessToken: string): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const ffprobePath = ffprobeStatic.path;

    if (!ffprobePath) {
      console.warn("[Probe] ffprobe-static did not return a binary path.");
      return resolve({ ...NULL_RESULT });
    }

    // Ensure the binary is executable (needed on Vercel/Linux after npm install)
    if (process.platform !== "win32" && fs.existsSync(ffprobePath)) {
      try {
        fs.chmodSync(ffprobePath, "755");
      } catch {
        // Non-fatal — chmod may fail in read-only FS; spawn will still try
      }
    }

    // Direct stream link to download the file Alt Media from Google Drive API v3
    const remoteUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    // Spawn ffprobe to inspect stream properties
    const ffprobeProcess = spawn(ffprobePath, [
      "-headers", `Authorization: Bearer ${accessToken}\r\n`,
      "-v", "quiet",
      "-print_format", "json",
      "-show_streams",
      remoteUrl
    ]);

    let stdoutData = "";
    ffprobeProcess.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString();
    });

    ffprobeProcess.on("close", (code) => {
      if (code !== 0) {
        console.warn(`[Probe] ffprobe exited with code ${code} for file ${fileId}`);
        return resolve({ ...NULL_RESULT });
      }

      try {
        const parsed = JSON.parse(stdoutData);
        const streams = parsed.streams || [];

        // --- Video stream ---
        const videoStream = streams.find((s: any) => s.codec_type === "video");
        const videoCodec = videoStream ? videoStream.codec_name : null;

        // Parse Dolby Vision Configuration Record if present in video side data list
        const doviRecord = videoStream?.side_data_list?.find(
          (sd: any) => sd.side_data_type === "DOVI configuration record"
        );
        const dvProfile = doviRecord ? parseInt(doviRecord.dv_profile, 10) : null;

        // --- Audio streams (all tracks, preserve order) ---
        // Index is 0-based among audio streams — matches ffmpeg's -map 0:a:{index}
        let audioFfmpegIdx = 0;
        const audioStreams: AudioStream[] = [];
        for (const s of streams) {
          if (s.codec_type !== "audio") continue;
          audioStreams.push({
            index: audioFfmpegIdx++,
            language: s.tags?.language ?? null,
            codec: s.codec_name ?? null,
            channels: s.channels ?? null,
          });
        }

        const audioCodec = audioStreams[0]?.codec ?? null; // backward compat field

        // --- Subtitle streams (text-based only, image-based excluded) ---
        // Index is 0-based among ALL subtitle streams — matches ffmpeg's -map 0:s:{index}
        // We increment for every subtitle stream but only push text-based ones,
        // so the stored index correctly maps to ffmpeg's subtitle stream numbering.
        let subtitleFfmpegIdx = 0;
        const subtitleStreams: SubtitleStream[] = [];
        for (const s of streams) {
          if (s.codec_type !== "subtitle") continue;
          const currentIdx = subtitleFfmpegIdx++;
          if (!TEXT_SUBTITLE_CODECS.has(s.codec_name)) continue; // skip image-based
          subtitleStreams.push({
            index: currentIdx,
            language: s.tags?.language ?? null,
            codec: s.codec_name ?? null,
          });
        }

        console.log(
          `[Probe] ${fileId}: video=${videoCodec}, dv=${dvProfile}, ` +
          `audio=${audioStreams.length} tracks, subtitles=${subtitleStreams.length} text tracks`
        );
        resolve({ dvProfile, audioCodec, videoCodec, audioStreams, subtitleStreams });
      } catch (err) {
        console.error(`[Probe] Failed to parse ffprobe stdout for ${fileId}:`, err);
        resolve({ ...NULL_RESULT });
      }
    });

    ffprobeProcess.on("error", (err) => {
      console.error(`[Probe] Failed to execute ffprobe for ${fileId}:`, err);
      resolve({ ...NULL_RESULT });
    });
  });
}
