import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";
import { google } from "googleapis";
import { env } from "@/config/env";
import { Readable } from "stream";
import { verifyStreamToken } from "@/lib/token";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Resolve and validate route params
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing media identifier." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const uid = searchParams.get("uid");

  const supabase = await createClient();
  let isAuthorized = false;

  // 2. Validate token or check cookie session
  if (token && uid) {
    if (verifyStreamToken(id, uid, token)) {
      // Validate that the user exists and is approved in the database
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_approved")
        .eq("id", uid)
        .maybeSingle();

      if (profile?.is_approved) {
        isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_approved")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || !profile.is_approved) {
      return NextResponse.json({ error: "Approval pending." }, { status: 403 });
    }
  }

  // 4. Fetch the Drive file ID and metadata from the media library database
  const { data: media, error: dbError } = await supabase
    .from("media_library")
    .select("drive_file_id, processed_drive_file_id, mime_type, file_size")
    .eq("id", id)
    .maybeSingle();

  if (dbError || !media) {
    return NextResponse.json({ error: "Media file not found in library." }, { status: 404 });
  }

  const paramDriveFileId = searchParams.get("driveFileId");

  const fileId = paramDriveFileId || media.processed_drive_file_id || media.drive_file_id;
  const mimeType = paramDriveFileId ? "video/mp4" : (media.mime_type || "video/mp4");
  let fileSize = media.file_size;

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

    // Fetch size of variant if needed
    if (paramDriveFileId || !fileSize) {
      const metaRes = await drive.files.get({
        fileId,
        fields: "size",
      });
      fileSize = metaRes.data.size ? parseInt(metaRes.data.size, 10) : null;
    }

    // 6. Define fixed chunk size cap: 32MB (Balances buffering smoothness vs Vercel execution timeouts)
    const CHUNK_SIZE = 32 * 1024 * 1024; // 32MB

    // 7. Parse the Range header and clamp the chunk size bounds
    const rangeHeader = request.headers.get("range");

    let start = 0;
    let end = fileSize ? fileSize - 1 : CHUNK_SIZE - 1;

    if (rangeHeader && fileSize) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      start = parseInt(parts[0], 10);
      
      if (parts[1]) {
        end = parseInt(parts[1], 10);
      } else {
        end = Math.min(start + CHUNK_SIZE - 1, fileSize - 1);
      }
    } else if (fileSize) {
      start = 0;
      end = Math.min(CHUNK_SIZE - 1, fileSize - 1);
    }

    // Validate range bounds
    if (fileSize && (start >= fileSize || end >= fileSize || start > end)) {
      return new Response("Requested range not satisfiable", {
        status: 416,
        headers: {
          "Content-Range": `bytes */${fileSize}`,
        },
      });
    }

    const contentLength = end - start + 1;

    // 8. Fetch byte chunk stream from Google Drive
    const driveStreamRes = await drive.files.get(
      {
        fileId,
        alt: "media",
      },
      {
        headers: {
          Range: `bytes=${start}-${end}`,
        },
        responseType: "stream",
      }
    );

    const stream = driveStreamRes.data as unknown as Readable;

    // Convert standard Node stream to web stream for Next.js response context
    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
      cancel() {
        stream.destroy();
      }
    });

    const responseHeaders: Record<string, string> = {
      "Accept-Ranges": "bytes",
      "Content-Length": contentLength.toString(),
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=3600",
    };

    if (fileSize) {
      responseHeaders["Content-Range"] = `bytes ${start}-${end}/${fileSize}`;
    }

    return new Response(webStream, {
      status: 206,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error(`[Streaming Proxy] Failed to stream file ${fileId}:`, err);
    return NextResponse.json({ error: "Failed to initialize stream." }, { status: 500 });
  }
}
