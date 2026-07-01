import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";
import { env } from "@/config/env";

export const runtime = "edge";
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

  // 4. Fetch the Drive file ID and metadata from the media library database
  const { data: media, error: dbError } = await supabase
    .from("media_library")
    .select("drive_file_id, processed_drive_file_id, mime_type, file_size")
    .eq("id", id)
    .maybeSingle();

  if (dbError || !media) {
    return NextResponse.json({ error: "Media file not found in library." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const paramDriveFileId = searchParams.get("driveFileId");

  const fileId = paramDriveFileId || media.processed_drive_file_id || media.drive_file_id;
  const mimeType = paramDriveFileId ? "video/mp4" : (media.mime_type || "video/mp4");
  let fileSize = media.file_size;

  try {
    // 5. Get access token from Google OAuth endpoint using fetch (Edge-safe)
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        refresh_token: env.googleRefreshToken,
        grant_type: "refresh_token",
      }),
    });
    
    if (!tokenRes.ok) {
      throw new Error(`Failed to refresh Google token: ${tokenRes.statusText}`);
    }
    
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      throw new Error("Access token not found in Google response.");
    }

    // 6. Get file size dynamically if not present or if streaming a variant
    if (paramDriveFileId || !fileSize) {
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=size`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (metaRes.ok) {
        const meta = await metaRes.json();
        fileSize = meta.size ? parseInt(meta.size, 10) : null;
      }
    }

    // 7. Define fixed chunk size cap: 64MB (Large buffer for smooth streaming under Edge runtime)
    const CHUNK_SIZE = 64 * 1024 * 1024; // 64MB

    // 8. Parse the Range header and clamp the chunk size bounds
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

    // 9. Fetch byte chunk stream from Google Drive using standard fetch (Edge compatible)
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Range: `bytes=${start}-${end}`,
        },
      }
    );

    if (!driveRes.ok) {
      throw new Error(`Google Drive Alt Media request failed: ${driveRes.statusText}`);
    }

    // Pass the body stream from Google Drive directly back to client
    const webStream = driveRes.body;
    if (!webStream) {
      throw new Error("No readable stream received from Google Drive.");
    }

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
    console.error(`[Streaming Proxy Edge] Failed to stream file ${fileId}:`, err);
    return NextResponse.json({ error: "Failed to initialize stream." }, { status: 500 });
  }
}
