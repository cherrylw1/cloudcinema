import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";
import { google } from "googleapis";
import { env } from "@/config/env";
import { Readable } from "stream";

// Dynamic routing config for binary file piping
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

  // 2. Perform user session verification inside the route
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  // 3. Verify the user is approved (is_approved = true)
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

    // 6. Retrieve metadata (size and MIME type) from Google Drive
    const metaRes = await drive.files.get({
      fileId,
      fields: "mimeType,size",
    });

    const mimeType = metaRes.data.mimeType || "video/mp4";
    const fileSizeString = metaRes.data.size;
    const fileSize = fileSizeString ? parseInt(fileSizeString, 10) : null;

    // 7. Parse Range header if present
    const rangeHeader = request.headers.get("range");

    if (rangeHeader && fileSize) {
      // Expected Format: bytes=start-end
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      // Validate range constraints
      if (start >= fileSize || end >= fileSize || start > end) {
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

      return new Response(webStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": contentLength.toString(),
          "Content-Type": mimeType,
          "Cache-Control": "public, max-age=3600",
        },
      });
    } else {
      // 9. Fetch the full file stream if no Range header is supplied
      const driveStreamRes = await drive.files.get(
        {
          fileId,
          alt: "media",
        },
        {
          responseType: "stream",
        }
      );

      const stream = driveStreamRes.data as unknown as Readable;

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
        "Content-Type": mimeType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      };

      if (fileSize) {
        responseHeaders["Content-Length"] = fileSize.toString();
      }

      return new Response(webStream, {
        status: 200,
        headers: responseHeaders,
      });
    }
  } catch (err) {
    console.error(`[Streaming Proxy] Failed to stream file ${fileId}:`, err);
    return NextResponse.json({ error: "Failed to initialize stream." }, { status: 500 });
  }
}
