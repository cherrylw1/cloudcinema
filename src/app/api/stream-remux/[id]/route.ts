import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";
import { google } from "googleapis";
import { env } from "@/config/env";
import { spawn, ChildProcess } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { Readable } from "stream";
import path from "path";
import fs from "fs";
import { probeMetadata } from "@/server/services/metadata-probe-service";
import type { AudioStream } from "@/repositories/media";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Parse query parameters
  const { searchParams } = new URL(_request.url);
  const audioTrackParam = searchParams.get("audioTrack");
  const audioTrackIdx = audioTrackParam ? parseInt(audioTrackParam, 10) : 0;

  // 1. Resolve and validate route params
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing media identifier." }, { status: 400 });
  }

  // 2. Perform user session verification inside the route (no redirect)
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  // 3. Verify user approval status
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_approved) {
    return NextResponse.json({ error: "Approval pending." }, { status: 403 });
  }

  // 4. Fetch the Drive file ID and metadata from the media library database
  const { data: media, error: dbError } = await supabase
    .from("media_library")
    .select("drive_file_id, dv_profile, audio_codec, audio_streams, title")
    .eq("id", id)
    .maybeSingle();

  if (dbError || !media) {
    return NextResponse.json({ error: "Media file not found in library." }, { status: 404 });
  }

  const fileId = media.drive_file_id;
  const dvProfile = media.dv_profile;
  const audioCodec = media.audio_codec;
  const title = media.title || "";

  // Filename-based HEVC/DV detection — reliable without needing ffprobe.
  // DV-encoded files are always HEVC and virtually always carry these tags
  // in the filename (set by the encoder/release group).
  const isLikelyHevc = /\b(hevc|x265|h\.?265|dovi|dov1|dolby[.\s_-]?vision|hdr10|uhd)\b/i.test(title);
  const isLikelyDV   = /\b(dovi|dov1|dolby[.\s_-]?vision|dv[.\s_-]?hdr|\bDV\b)\b/i.test(title);

  try {
    // 5. Initialize the Google Drive Client
    const oauth2Client = new google.auth.OAuth2(
      env.googleClientId,
      env.googleClientSecret,
      env.googleRedirectUri
    );

    oauth2Client.setCredentials({
      refresh_token: env.googleRefreshToken,
    });

    const drive = google.drive({ version: "v3", auth: oauth2Client });
    const tokenInfo = await oauth2Client.getAccessToken();
    const accessToken = tokenInfo.token;

    if (!accessToken) {
      throw new Error("Failed to retrieve Google Drive OAuth access token.");
    }

    // 6. Fetch the full file stream from Google Drive
    const driveStreamRes = await drive.files.get(
      {
        fileId,
        alt: "media",
      },
      {
        responseType: "stream",
      }
    );

    const driveStream = driveStreamRes.data as unknown as Readable;

    if (!ffmpegPath) {
      throw new Error("FFmpeg static binary path could not be resolved.");
    }

    // Resolve dovi_tool path and set executable permissions
    const doviToolPath = path.join(process.cwd(), "src/bin/dovi_tool");
    const isWindows = process.platform === "win32";
    const doviToolExists = fs.existsSync(doviToolPath);

    if (doviToolExists && !isWindows) {
      try {
        fs.chmodSync(doviToolPath, "755");
      } catch (err) {
        console.warn("[Remux] Failed to set permissions on dovi_tool:", err);
      }
    }

    // Determine transcoding requirements:
    // If DB metadata is missing, probe the file on-the-fly to get codec info.
    // This adds ~1-2s on first play, but ensures the correct pipeline is always used.
    let effectiveAudioCodec = audioCodec;
    let effectiveVideoCodec: string | null = null;
    let effectiveDvProfile = dvProfile;
    let effectiveAudioStreams: AudioStream[] = (media.audio_streams as unknown as AudioStream[]) || [];

    if (audioCodec === null || effectiveAudioStreams.length === 0) {
      console.log(`[Remux] DB metadata missing or empty for ${fileId}, probing on-the-fly...`);
      try {
        const probe = await probeMetadata(fileId, accessToken);
        effectiveAudioCodec = probe.audioCodec;
        effectiveVideoCodec = probe.videoCodec;
        effectiveDvProfile = probe.dvProfile;
        effectiveAudioStreams = probe.audioStreams;
        console.log(`[Remux] Probe: video=${effectiveVideoCodec}, audio=${effectiveAudioCodec}, dv=${effectiveDvProfile}, tracks=${effectiveAudioStreams.length}`);
      } catch (err) {
        console.warn(`[Remux] On-the-fly probe failed, proceeding with defaults:`, err);
      }
    }

    // Identify the specific audio track codec to see if we should transcode it
    const selectedTrack = effectiveAudioStreams.find((t: AudioStream) => t.index === audioTrackIdx);
    const selectedCodec = selectedTrack ? selectedTrack.codec : effectiveAudioCodec;

    // For HEVC: ALWAYS run through dovi_tool regardless of detected dvProfile.
    const isHevc = effectiveVideoCodec === "hevc" || isLikelyHevc || dvProfile !== null;
    const shouldStripDovi = isHevc && !isWindows && doviToolExists;

    if (isLikelyDV) {
      console.log(`[Remux] DV keywords found in filename "${title}" — will strip DV layer via dovi_tool.`);
    }

    // Always transcode audio to AAC if the selected codec is unsupported.
    const isAudioUnsupported = selectedCodec
      ? !["aac", "mp3", "opus", "vorbis"].includes(selectedCodec.toLowerCase())
      : true; // If unknown, assume unsupported and transcode to be safe

    if (effectiveDvProfile === 5) {
      console.log(`[Remux] Dolby Vision Profile 5 detected for ${fileId}. Color tint is expected — unfixable without GPU transcoding.`);
    }

    let webStream: ReadableStream;
    let processesToKill: ChildProcess[] = [];

    // NOTE: This route DOES NOT support seeking (HTTP Range requests). It always serves a
    // sequential lossless stream from the start (0). This is a known design constraint.
    if (shouldStripDovi) {
      console.log(`[Remux] Dolby Vision Profile ${dvProfile} detected. Spawning dovi_tool extraction pipeline...`);

      // Process 1: Extract HEVC bitstream with Annex B conversion
      const ffmpeg1 = spawn(ffmpegPath, [
        "-i", "pipe:0",
        "-an",
        "-c:v", "copy",
        "-bsf:v", "hevc_mp4toannexb",
        "-f", "hevc",
        "pipe:1"
      ]);

      // Process 2: Strip Dolby Vision RPU metadata
      const dovi = spawn(doviToolPath, [
        "remove",
        "-"
      ]);

      // Process 3: Remap audio and video, mux back to fragmented MP4
      const ffmpeg2Args = [
        "-i", "pipe:0", // Input from dovi_tool
        "-headers", `Authorization: Bearer ${accessToken}\r\n`,
        "-i", `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        "-map", "0:v",
      ];

      const hasAudio = effectiveAudioStreams && effectiveAudioStreams.length > 0;
      if (hasAudio) {
        ffmpeg2Args.push("-map", `1:a:${audioTrackIdx}`);
        if (isAudioUnsupported) {
          console.log(`[Remux] Non-decodable audio (${selectedCodec}) detected. Transcoding to AAC...`);
          ffmpeg2Args.push("-c:a", "aac", "-b:a", "320k");
        } else {
          ffmpeg2Args.push("-c:a", "copy");
        }
      }

      ffmpeg2Args.push(
        "-movflags", "frag_keyframe+empty_moov+default_base_moof",
        "-f", "mp4",
        "pipe:1"
      );

      const ffmpeg2 = spawn(ffmpegPath, ffmpeg2Args);

      processesToKill = [ffmpeg1, dovi, ffmpeg2];

      // Pipe streams
      driveStream.pipe(ffmpeg1.stdin);
      ffmpeg1.stdout.pipe(dovi.stdin);
      dovi.stdout.pipe(ffmpeg2.stdin);

      webStream = new ReadableStream({
        start(controller) {
          ffmpeg2.stdout.on("data", (chunk) => controller.enqueue(chunk));
          ffmpeg2.stdout.on("end", () => controller.close());
          ffmpeg2.stdout.on("error", (err) => controller.error(err));
        },
        cancel() {
          processesToKill.forEach((p) => {
            try { p.kill(); } catch {}
          });
          driveStream.destroy();
        }
      });
    } else {
      // Normal remux path (with optional audio transcoding)
      console.log(`[Remux] Spawning single FFmpeg remuxer...`);

      const ffmpegArgs = [
        "-i", "pipe:0",
        "-map", "0:v:0",
        "-c:v", "copy"
      ];

      const hasAudio = effectiveAudioStreams && effectiveAudioStreams.length > 0;
      if (hasAudio) {
        ffmpegArgs.push("-map", `0:a:${audioTrackIdx}`);
        if (isAudioUnsupported) {
          console.log(`[Remux] Non-decodable audio (${selectedCodec}) detected. Transcoding to AAC...`);
          ffmpegArgs.push("-c:a", "aac", "-b:a", "320k");
        } else {
          ffmpegArgs.push("-c:a", "copy");
        }
      }

      ffmpegArgs.push(
        "-movflags", "frag_keyframe+empty_moov+default_base_moof",
        "-f", "mp4",
        "pipe:1"
      );

      const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
      processesToKill = [ffmpegProcess];

      driveStream.pipe(ffmpegProcess.stdin);

      webStream = new ReadableStream({
        start(controller) {
          ffmpegProcess.stdout.on("data", (chunk) => controller.enqueue(chunk));
          ffmpegProcess.stdout.on("end", () => controller.close());
          ffmpegProcess.stdout.on("error", (err) => controller.error(err));
        },
        cancel() {
          ffmpegProcess.kill();
          driveStream.destroy();
        }
      });
    }

    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    console.error(`[Remux Proxy] Failed to remux file ${fileId}:`, err);
    return NextResponse.json({ error: "Failed to initialize remuxing stream." }, { status: 500 });
  }
}
