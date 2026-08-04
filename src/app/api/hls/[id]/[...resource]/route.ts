import { Readable } from "stream";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";
import { createAdminClient } from "@/clients/supabase/admin";
import { env } from "@/config/env";
import type { HlsManifest } from "@/repositories/media";
import { signedR2ObjectUrl } from "@/server/r2-delivery";

export const dynamic = "force-dynamic";

function quoteAttribute(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function signedR2MediaUrl(
  mediaId: string,
  rendition: HlsManifest["video"] | HlsManifest["audio"][number],
) {
  return rendition.r2Key ? signedR2ObjectUrl(mediaId, rendition.r2Key, "hls") : null;
}

async function driveProxyMediaUrl(
  rendition: HlsManifest["video"] | HlsManifest["audio"][number],
) {
  if (!env.streamProxyUrl) return null;

  const oauth2Client = new google.auth.OAuth2(
    env.googleClientId,
    env.googleClientSecret,
    env.googleRedirectUri,
  );
  oauth2Client.setCredentials({ refresh_token: env.googleRefreshToken });
  const tokenInfo = await oauth2Client.getAccessToken();
  if (!tokenInfo.token) return null;

  const url = new URL(env.streamProxyUrl);
  url.searchParams.set("fileId", rendition.driveFileId);
  url.searchParams.set("token", tokenInfo.token);
  url.searchParams.set("fileSize", String(rendition.fileSize));
  return url.toString();
}

async function mediaUrl(
  mediaId: string,
  rendition: HlsManifest["video"] | HlsManifest["audio"][number],
  fallback: string,
) {
  return signedR2MediaUrl(mediaId, rendition) ?? await driveProxyMediaUrl(rendition) ?? fallback;
}

function masterPlaylist(id: string, manifest: HlsManifest) {
  const base = `/api/hls/${encodeURIComponent(id)}`;
  const lines = [
    "#EXTM3U",
    "#EXT-X-VERSION:7",
    "#EXT-X-INDEPENDENT-SEGMENTS",
  ];

  for (const track of manifest.audio) {
    lines.push(
      `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="${quoteAttribute(track.label)}",` +
      `LANGUAGE="${quoteAttribute(track.language)}",DEFAULT=${track.default ? "YES" : "NO"},` +
      `AUTOSELECT=YES,CHANNELS="${track.channels}",URI="${base}/audio/${track.index}.m3u8"`,
    );
  }

  const resolution = manifest.video.width && manifest.video.height
    ? `,RESOLUTION=${manifest.video.width}x${manifest.video.height}`
    : "";
  const audioGroup = manifest.audio.length > 0 ? ',AUDIO="audio"' : "";
  lines.push(
    `#EXT-X-STREAM-INF:BANDWIDTH=${manifest.video.bandwidth}` +
    `${resolution}${audioGroup}`,
    `${base}/video.m3u8`,
  );

  return `${lines.join("\n")}\n`;
}

function rewriteMediaPlaylist(playlist: string, mediaUrl: string) {
  return playlist
    .split(/\r?\n/)
    .map((line) => {
      if (line.startsWith("#EXT-X-MAP:")) {
        return line.replace(/URI="[^"]+"/, `URI="${mediaUrl}"`);
      }
      if (line.length > 0 && !line.startsWith("#")) {
        return mediaUrl;
      }
      return line;
    })
    .join("\n");
}

async function approvedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_approved")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.is_approved === true;
}

async function streamDriveRange(
  request: NextRequest,
  fileId: string,
  fileSize: number,
  contentType: string,
) {
  const rangeHeader = request.headers.get("range");
  let start = 0;
  let end = fileSize - 1;

  if (rangeHeader) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
    if (!match) {
      return new Response("Requested range not satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : fileSize - 1;
  }

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start > end ||
    end >= fileSize
  ) {
    return new Response("Requested range not satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${fileSize}` },
    });
  }

  const oauth2Client = new google.auth.OAuth2(
    env.googleClientId,
    env.googleClientSecret,
    env.googleRedirectUri,
  );
  oauth2Client.setCredentials({ refresh_token: env.googleRefreshToken });
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  const driveResponse = await drive.files.get(
    { fileId, alt: "media" },
    {
      headers: { Range: `bytes=${start}-${end}` },
      responseType: "stream",
    },
  );
  const nodeStream = driveResponse.data as unknown as Readable;
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk) => controller.enqueue(chunk));
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (error) => controller.error(error));
    },
    cancel() {
      nodeStream.destroy();
    },
  });

  const isPartial = Boolean(rangeHeader);
  const headers: Record<string, string> = {
    "Accept-Ranges": "bytes",
    "Content-Length": String(end - start + 1),
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=3600",
  };
  if (isPartial) headers["Content-Range"] = `bytes ${start}-${end}/${fileSize}`;

  return new Response(webStream, {
    status: isPartial ? 206 : 200,
    headers,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; resource: string[] }> },
) {
  if (!(await approvedUser())) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  const { id, resource } = await params;
  const admin = createAdminClient();
  const { data: media, error } = await admin
    .from("media_library")
    .select("audio_streams")
    .eq("id", id)
    .maybeSingle();

  if (error || !media) {
    return NextResponse.json({ error: "Media file not found." }, { status: 404 });
  }

  const streamMetadata = media.audio_streams as unknown as {
    browserHls?: HlsManifest;
  } | null;
  const manifest = streamMetadata?.browserHls ?? null;
  if (!manifest?.video || !Array.isArray(manifest.audio)) {
    return NextResponse.json({ error: "Browser playback is not prepared yet." }, { status: 409 });
  }

  const path = resource.join("/");
  const base = `/api/hls/${encodeURIComponent(id)}`;

  if (path === "master.m3u8") {
    return new Response(masterPlaylist(id, manifest), {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  if (path === "video.m3u8") {
    const videoUrl = await mediaUrl(id, manifest.video, `${base}/video.mp4`);
    return new Response(
      rewriteMediaPlaylist(manifest.video.playlist, videoUrl),
      {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "private, max-age=300",
        },
      },
    );
  }

  if (path === "video.mp4") {
    return streamDriveRange(
      request,
      manifest.video.driveFileId,
      manifest.video.fileSize,
      "video/mp4",
    );
  }

  const audioMatch = /^audio\/(\d+)\.(m3u8|mp4)$/.exec(path);
  if (audioMatch) {
    const index = Number(audioMatch[1]);
    const track = manifest.audio.find((item) => item.index === index);
    if (!track) {
      return NextResponse.json({ error: "Audio track not found." }, { status: 404 });
    }

    if (audioMatch[2] === "m3u8") {
      const audioUrl = await mediaUrl(id, track, `${base}/audio/${index}.mp4`);
      return new Response(
        rewriteMediaPlaylist(track.playlist, audioUrl),
        {
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Cache-Control": "private, max-age=300",
          },
        },
      );
    }

    return streamDriveRange(
      request,
      track.driveFileId,
      track.fileSize,
      "audio/mp4",
    );
  }

  return NextResponse.json({ error: "HLS resource not found." }, { status: 404 });
}
