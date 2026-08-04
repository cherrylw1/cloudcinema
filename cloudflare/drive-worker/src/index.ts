interface DriveMetadata {
  size?: string;
  mimeType?: string;
}

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const RANGE_SIZE = 64 * 1024 * 1024;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Range, Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Expose-Headers": "Accept-Ranges, Content-Length, Content-Range, ETag",
  };
}

function errorResponse(message: string, status: number) {
  return new Response(message, { status, headers: corsHeaders() });
}

function parseSize(value: string | null) {
  if (!value) return null;
  const size = Number(value);
  return Number.isSafeInteger(size) && size > 0 ? size : null;
}

function parseRange(value: string | null, size: number) {
  if (!value) {
    return { start: 0, end: Math.min(RANGE_SIZE - 1, size - 1) };
  }

  const match = /^bytes=(\d+)-(\d*)$/.exec(value);
  if (!match) return null;

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd)) return null;
  if (start >= size || requestedEnd < start) return null;

  return {
    start,
    end: Math.min(requestedEnd, start + RANGE_SIZE - 1, size - 1),
  };
}

async function getDriveMetadata(fileId: string, token: string) {
  const response = await fetch(
    `${DRIVE_API}/${encodeURIComponent(fileId)}?fields=size,mimeType`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) return null;
  return await response.json() as DriveMetadata;
}

function responseHeaders(
  upstream: Response,
  contentType: string,
  start: number,
  end: number,
  size: number,
) {
  const headers = new Headers(corsHeaders());
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Type", upstream.headers.get("Content-Type") || contentType);
  headers.set("Content-Length", String(end - start + 1));
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Cache-Control", "no-store");
  headers.set("X-CloudCinema-Source", "google-drive");
  const etag = upstream.headers.get("ETag");
  if (etag) headers.set("ETag", etag);
  return headers;
}

async function handle(request: Request) {
  const url = new URL(request.url);
  const fileId = url.searchParams.get("fileId")?.trim();
  const token = url.searchParams.get("token")?.trim();
  if (!fileId || !/^[A-Za-z0-9_-]+$/.test(fileId) || !token) {
    return errorResponse("Missing or invalid stream credentials.", 400);
  }

  const providedSize = parseSize(url.searchParams.get("fileSize"));
  const metadata = request.method === "HEAD" || !providedSize
    ? await getDriveMetadata(fileId, token)
    : null;
  const size = providedSize || parseSize(metadata?.size || null);
  if (!size) return errorResponse("Drive file size is unavailable.", 502);

  const contentType = metadata?.mimeType || "video/mp4";
  if (request.method === "HEAD") {
    const headers = new Headers(corsHeaders());
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Type", contentType);
    headers.set("Content-Length", String(size));
    headers.set("Cache-Control", "no-store");
    headers.set("X-CloudCinema-Source", "google-drive");
    return new Response(null, { status: 200, headers });
  }

  const range = parseRange(request.headers.get("Range"), size);
  if (!range) {
    return new Response("Requested range not satisfiable.", {
      status: 416,
      headers: { ...corsHeaders(), "Content-Range": `bytes */${size}` },
    });
  }

  const upstream = await fetch(
    `${DRIVE_API}/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Accept-Encoding": "identity",
        Range: `bytes=${range.start}-${range.end}`,
      },
    },
  );

  if (!upstream.ok || upstream.status !== 206) {
    return errorResponse(`Drive returned HTTP ${upstream.status}.`, 502);
  }

  return new Response(upstream.body, {
    status: 206,
    headers: responseHeaders(upstream, contentType, range.start, range.end, size),
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return errorResponse("Method not allowed.", 405);
    }
    try {
      return await handle(request);
    } catch (error) {
      console.error("Drive stream failed", error);
      return errorResponse("Unable to initialize Drive stream.", 502);
    }
  },
};
