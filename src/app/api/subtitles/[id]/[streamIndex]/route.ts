import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";
import { google } from "googleapis";
import { env } from "@/config/env";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { Readable } from "stream";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; streamIndex: string }> }
) {
  const { id, streamIndex } = await params;
  if (!id || streamIndex === undefined) {
    return NextResponse.json({ error: "Missing media identifier or stream index." }, { status: 400 });
  }

  const subtitleIndex = parseInt(streamIndex, 10);
  if (isNaN(subtitleIndex)) {
    return NextResponse.json({ error: "Invalid stream index." }, { status: 400 });
  }

  // 1. Perform user session verification inside the route (no redirect)
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  // 2. Verify user approval status
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_approved) {
    return NextResponse.json({ error: "Approval pending." }, { status: 403 });
  }

  // 3. Fetch the Drive file ID from the media library database
  const { data: media, error: dbError } = await supabase
    .from("media_library")
    .select("drive_file_id")
    .eq("id", id)
    .maybeSingle();

  if (dbError || !media) {
    return NextResponse.json({ error: "Media file not found in library." }, { status: 404 });
  }

  const fileId = media.drive_file_id;

  try {
    // 4. Initialize the Google Drive Client
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

    // 5. Fetch the file stream from Google Drive
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

    // 6. Spawn FFmpeg to extract subtitle and convert to WebVTT
    // -map 0:s:index maps the index-th subtitle stream.
    const ffmpegProcess = spawn(ffmpegPath, [
      "-i", "pipe:0",
      "-map", `0:s:${subtitleIndex}`,
      "-f", "webvtt",
      "pipe:1"
    ]);

    driveStream.pipe(ffmpegProcess.stdin);

    const webStream = new ReadableStream({
      start(controller) {
        ffmpegProcess.stdout.on("data", (chunk) => controller.enqueue(chunk));
        ffmpegProcess.stdout.on("end", () => controller.close());
        ffmpegProcess.stdout.on("error", (err) => controller.error(err));
        ffmpegProcess.stderr.on("data", (chunk) => {
          // Log ffmpeg output to console if needed for debug
          const msg = chunk.toString();
          if (msg.includes("Error")) {
            console.warn(`[Subtitle Extraction FFmpeg] ${msg.trim()}`);
          }
        });
      },
      cancel() {
        ffmpegProcess.kill();
        driveStream.destroy();
      }
    });

    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error(`[Subtitle Proxy] Failed to extract subtitles for ${id} (stream ${subtitleIndex}):`, err);
    return NextResponse.json({ error: "Failed to extract subtitles." }, { status: 500 });
  }
}
