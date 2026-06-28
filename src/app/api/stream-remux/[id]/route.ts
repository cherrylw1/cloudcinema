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
  { params }: { params: Promise<{ id: string }> }
) {
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

  // 4. Fetch the Drive file ID from the media library database
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

    // 7. Verify FFmpeg binary exists
    if (!ffmpegPath) {
      throw new Error("FFmpeg static binary path could not be resolved.");
    }

    // 8. Spawn FFmpeg process
    // NOTE: This route DOES NOT support seeking (HTTP Range requests). It always serves a
    // sequential lossless stream from the start (0). This is a known design constraint.
    const ffmpegProcess = spawn(ffmpegPath, [
      "-i", "pipe:0", // Read input from standard input pipe
      "-c", "copy",   // Copy video/audio streams losslessly (no transcoding/re-encoding)
      "-movflags", "frag_keyframe+empty_moov+default_base_moof", // Fragmented MP4 flags for streaming piping
      "-f", "mp4",    // Output container format
      "pipe:1"        // Write output to standard output pipe
    ]);

    // Pipe Drive stream into FFmpeg stdin
    driveStream.pipe(ffmpegProcess.stdin);

    // Capture logs for debugging
    ffmpegProcess.stderr.on("data", (chunk) => {
      console.log(`[FFmpeg Remux Log] ${chunk.toString().trim()}`);
    });

    // Handle stream errors
    driveStream.on("error", (err) => {
      console.error("[Remux Proxy] Drive stream failed:", err);
      ffmpegProcess.kill();
    });

    ffmpegProcess.stdin.on("error", (err) => {
      console.error("[Remux Proxy] FFmpeg stdin error:", err);
    });

    // Convert FFmpeg stdout standard node stream to web stream for Next.js response context
    const webStream = new ReadableStream({
      start(controller) {
        ffmpegProcess.stdout.on("data", (chunk) => controller.enqueue(chunk));
        ffmpegProcess.stdout.on("end", () => controller.close());
        ffmpegProcess.stdout.on("error", (err) => controller.error(err));
      },
      cancel() {
        ffmpegProcess.kill();
      }
    });

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
