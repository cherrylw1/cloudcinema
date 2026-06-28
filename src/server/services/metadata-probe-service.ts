/* eslint-disable @typescript-eslint/no-explicit-any */
import { spawn } from "child_process";
import fs from "fs";
// ffprobe-static is a proper npm package — Vercel bundles it correctly,
// including the platform-appropriate binary inside node_modules.
import ffprobeStatic from "ffprobe-static";

export interface ProbeResult {
  dvProfile: number | null;
  audioCodec: string | null;
}

/**
 * Runs ffprobe on a remote Google Drive media file using OAuth2 bearer authentication.
 * Returns Dolby Vision profile (if present) and the primary audio codec name.
 */
export function probeMetadata(fileId: string, accessToken: string): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const ffprobePath = ffprobeStatic.path;

    if (!ffprobePath) {
      console.warn("[Probe] ffprobe-static did not return a binary path.");
      return resolve({ dvProfile: null, audioCodec: null });
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
        return resolve({ dvProfile: null, audioCodec: null });
      }

      try {
        const parsed = JSON.parse(stdoutData);
        const streams = parsed.streams || [];

        // Identify primary streams
        const videoStream = streams.find((s: any) => s.codec_type === "video");
        const audioStream = streams.find((s: any) => s.codec_type === "audio");

        const audioCodec = audioStream ? audioStream.codec_name : null;

        // Parse Dolby Vision Configuration Record if present in video side data list
        const doviRecord = videoStream?.side_data_list?.find(
          (sd: any) => sd.side_data_type === "DOVI configuration record"
        );
        const dvProfile = doviRecord ? parseInt(doviRecord.dv_profile, 10) : null;

        console.log(`[Probe] Success for file ${fileId}: Profile ${dvProfile}, Audio ${audioCodec}`);
        resolve({ dvProfile, audioCodec });
      } catch (err) {
        console.error(`[Probe] Failed to parse ffprobe stdout for ${fileId}:`, err);
        resolve({ dvProfile: null, audioCodec: null });
      }
    });

    ffprobeProcess.on("error", (err) => {
      console.error(`[Probe] Failed to execute ffprobe for ${fileId}:`, err);
      resolve({ dvProfile: null, audioCodec: null });
    });
  });
}
