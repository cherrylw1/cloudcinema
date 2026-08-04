interface R2Range {
  offset?: number;
  length?: number;
  suffix?: number;
}

interface R2ObjectBody {
  body: ReadableStream<Uint8Array>;
  size: number;
  httpEtag?: string;
  uploaded?: Date;
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
  };
  range?: {
    offset?: number;
    length?: number;
  };
}

interface R2Bucket {
  get(key: string, options?: { range?: R2Range }): Promise<R2ObjectBody | null>;
  head(key: string): Promise<R2ObjectBody | null>;
}

interface Env {
  MEDIA_BUCKET: R2Bucket;
  MEDIA_SIGNING_SECRET: string;
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signature(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return hex(new Uint8Array(digest));
}

function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

function parseRange(value: string | null) {
  if (!value) return null;
  const match = /^bytes=(\d+)-(\d*)$/.exec(value);
  if (!match) return null;
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : null;
  if (!Number.isSafeInteger(start) || (requestedEnd !== null && !Number.isSafeInteger(requestedEnd))) {
    return null;
  }
  return { start, requestedEnd };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Range, Content-Type",
    "Access-Control-Expose-Headers": "Accept-Ranges, Content-Length, Content-Range, ETag",
  };
}

function objectHeaders(object: R2ObjectBody) {
  const headers = new Headers(corsHeaders());
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Type", object.httpMetadata?.contentType || "video/mp4");
  headers.set("Cache-Control", object.httpMetadata?.cacheControl || "public, max-age=31536000, immutable");
  if (object.httpEtag) headers.set("ETag", object.httpEtag);
  if (object.uploaded) headers.set("Last-Modified", object.uploaded.toUTCString());
  return headers;
}

async function handleMedia(request: Request, env: Env, mediaId: string, kind: "hls" | "media") {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const expires = Number(url.searchParams.get("exp"));
  const providedSignature = url.searchParams.get("sig") || "";

  if (!key || !Number.isSafeInteger(expires) || expires < Math.floor(Date.now() / 1000)) {
    return new Response("Invalid or expired media URL.", { status: 401, headers: corsHeaders() });
  }
  const expectedPrefix = kind === "hls" ? `hls/${mediaId}/` : `originals/${mediaId}/`;
  if (!key.startsWith(expectedPrefix)) {
    return new Response("Media URL does not match the requested title.", { status: 403, headers: corsHeaders() });
  }

  const expectedSignature = await signature(
    env.MEDIA_SIGNING_SECRET,
    `${mediaId}\n${key}\n${expires}`,
  );
  if (!equal(providedSignature, expectedSignature)) {
    return new Response("Invalid media signature.", { status: 403, headers: corsHeaders() });
  }

  const requestedRange = parseRange(request.headers.get("range"));
  if (request.headers.has("range") && !requestedRange) {
    return new Response("Requested range not satisfiable.", { status: 416, headers: corsHeaders() });
  }

  const head = requestedRange ? await env.MEDIA_BUCKET.head(key) : null;
  const totalSize = head?.size;
  if (requestedRange && totalSize !== undefined) {
    const end = requestedRange.requestedEnd ?? totalSize - 1;
    if (requestedRange.start > end || end >= totalSize) {
      return new Response("Requested range not satisfiable.", {
        status: 416,
        headers: { ...corsHeaders(), "Content-Range": `bytes */${totalSize}` },
      });
    }
  }

  const range = requestedRange
    ? {
        offset: requestedRange.start,
        ...(requestedRange.requestedEnd !== null && totalSize !== undefined
          ? { length: requestedRange.requestedEnd - requestedRange.start + 1 }
          : {}),
      }
    : undefined;
  const object = await env.MEDIA_BUCKET.get(key, range ? { range } : undefined);
  if (!object) {
    return new Response("Media object not found.", { status: 404, headers: corsHeaders() });
  }

  const headers = objectHeaders(object);
  if (requestedRange) {
    const start = object.range?.offset ?? requestedRange.start;
    const length = object.range?.length ?? object.size;
    const end = start + length - 1;
    headers.set("Content-Length", String(length));
    if (totalSize !== undefined) headers.set("Content-Range", `bytes ${start}-${end}/${totalSize}`);
    return new Response(request.method === "HEAD" ? null : object.body, { status: 206, headers });
  }

  headers.set("Content-Length", String(object.size));
  return new Response(request.method === "HEAD" ? null : object.body, { status: 200, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders(),
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        },
      });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed.", { status: 405, headers: corsHeaders() });
    }

    const pathname = new URL(request.url).pathname;
    const match = /^\/(hls|media)\/([^/]+)$/.exec(pathname);
    if (!match) return new Response("Not found.", { status: 404, headers: corsHeaders() });

    return handleMedia(request, env, decodeURIComponent(match[2]), match[1] as "hls" | "media");
  },
};
