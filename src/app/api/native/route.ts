import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/clients/supabase/admin";
import { generateStreamToken } from "@/lib/token";
import { DriveSyncService } from "@/server/services/drive-sync-service";
import { EmbeddingService } from "@/server/services/embedding-service";
import { MetadataSyncService } from "@/server/services/metadata-sync-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function approvedUser(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return null;

  const admin = createAdminClient();
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("display_name,avatar_url,is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_approved) return null;
  return { admin, user, profile };
}

function streamPath(mediaId: string, userId: string) {
  const token = generateStreamToken(mediaId, userId);
  return `/api/stream/${mediaId}/${token}/${userId}/video.mp4`;
}

function normalizeMedia(item: Record<string, unknown>, userId: string) {
  const audioMetadata = item.audio_streams;
  const audioStreams = Array.isArray(audioMetadata)
    ? audioMetadata
    : audioMetadata && typeof audioMetadata === "object" &&
        Array.isArray((audioMetadata as { tracks?: unknown }).tracks)
      ? (audioMetadata as { tracks: unknown[] }).tracks
      : [];
  return {
    ...item,
    audio_streams: audioStreams,
    subtitle_streams: Array.isArray(item.subtitle_streams)
      ? item.subtitle_streams
      : [],
    stream_url: streamPath(String(item.id), userId),
  };
}

function cleanFolderPath(value: string | null) {
  let path = (value || "/").trim();
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

export async function GET(request: NextRequest) {
  const auth = await approvedUser(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized native session." },
      {
        status: 401,
        headers: {
          "X-CloudCinema-Handler": "native",
          "X-CloudCinema-Native-Version": "2",
        },
      },
    );
  }

  const { searchParams } = request.nextUrl;
  const resource = searchParams.get("resource") || "catalog";

  if (resource === "profile") {
    return NextResponse.json({
      id: auth.user.id,
      email: auth.user.email || "",
      displayName: auth.profile.display_name,
      avatarUrl: auth.profile.avatar_url,
    });
  }

  if (resource === "progress") {
    const { data, error } = await auth.admin
      .from("user_progress")
      .select("*")
      .eq("profile_id", auth.user.id)
      .order("last_watched", { ascending: false })
      .limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  }

  if (resource === "watchlist") {
    const { data, error } = await auth.admin
      .from("watchlist")
      .select("media_id")
      .eq("user_id", auth.user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json((data || []).map((item) => item.media_id).filter(Boolean));
  }

  const id = searchParams.get("id");
  const query = searchParams.get("query")?.trim().replace(/[,%()]/g, " ");
  const type = searchParams.get("type");
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 80, 1), 200);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  if (resource === "stats") {
    const [all, movies, shows, anime, dv5, dv78] = await Promise.all([
      auth.admin.from("media_library").select("id", { count: "exact", head: true }),
      auth.admin.from("media_library").select("id", { count: "exact", head: true }).eq("media_type", "movie"),
      auth.admin.from("media_library").select("id", { count: "exact", head: true }).eq("media_type", "tv-show"),
      auth.admin.from("media_library").select("id", { count: "exact", head: true }).eq("media_type", "anime"),
      auth.admin.from("media_library").select("id", { count: "exact", head: true }).eq("dv_profile", 5),
      auth.admin.from("media_library").select("id", { count: "exact", head: true }).in("dv_profile", [7, 8]),
    ]);
    const error = [all, movies, shows, anime, dv5, dv78].find((result) => result.error)?.error;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      total: all.count || 0,
      movies: movies.count || 0,
      shows: shows.count || 0,
      anime: anime.count || 0,
      dv5: dv5.count || 0,
      dv78: dv78.count || 0,
    });
  }

  if (resource === "folders") {
    const path = cleanFolderPath(searchParams.get("path"));
    const { data: files, error: filesError } = await auth.admin
      .from("media_library")
      .select("*")
      .eq("folder_path", path)
      .order("title", { ascending: true })
      .range(offset, offset + limit - 1);
    if (filesError) {
      return NextResponse.json({ error: filesError.message }, { status: 500 });
    }

    const allPaths: Array<{ folder_path: string | null }> = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await auth.admin
        .from("media_library")
        .select("folder_path")
        .range(from, from + 999);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      allPaths.push(...(data || []));
      if (!data || data.length < 1000) break;
    }

    const currentSegments = path === "/" ? [] : path.split("/").filter(Boolean);
    const folders = new Set<string>();
    for (const row of allPaths) {
      const folderPath = cleanFolderPath(row.folder_path);
      const segments = folderPath.split("/").filter(Boolean);
      if (
        segments.length > currentSegments.length &&
        currentSegments.every((segment, index) => segments[index] === segment)
      ) {
        folders.add(segments[currentSegments.length]);
      }
    }
    return NextResponse.json({
      path,
      folders: Array.from(folders).sort((a, b) => a.localeCompare(b)),
      files: (files || []).map((item) => normalizeMedia(item, auth.user.id)),
    });
  }

  if (resource === "watchlist-media") {
    const { data: saved, error: savedError } = await auth.admin
      .from("watchlist")
      .select("media_id")
      .eq("user_id", auth.user.id);
    if (savedError) {
      return NextResponse.json({ error: savedError.message }, { status: 500 });
    }
    const ids = (saved || []).map((item) => item.media_id).filter(Boolean);
    if (ids.length === 0) return NextResponse.json([]);
    const page = ids.slice(offset, offset + limit);
    const { data, error } = await auth.admin
      .from("media_library")
      .select("*")
      .in("id", page);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json((data || []).map((item) => normalizeMedia(item, auth.user.id)));
  }

  let catalog = auth.admin
    .from("media_library")
    .select("*")
    .order("created_at", { ascending: false });

  if (id) catalog = catalog.eq("id", id);
  if (query) catalog = catalog.or(`title.ilike.%${query}%,series.ilike.%${query}%`);
  if (type && ["movie", "tv-show", "anime"].includes(type)) {
    catalog = catalog.eq("media_type", type);
  }
  if (!id) catalog = catalog.range(offset, offset + limit - 1);

  const { data, error } = await catalog;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const media = (data || []).map((item) => normalizeMedia(item, auth.user.id));
  return NextResponse.json(id ? (media[0] || null) : media);
}

export async function POST(request: NextRequest) {
  const auth = await approvedUser(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized native session." },
      {
        status: 401,
        headers: {
          "X-CloudCinema-Handler": "native",
          "X-CloudCinema-Native-Version": "2",
        },
      },
    );
  }

  const body = await request.json().catch(() => null) as {
    action?: string;
    mediaId?: string;
    position?: number;
    completed?: boolean;
  } | null;

  if (body?.action === "sync") {
    try {
      const result = await new DriveSyncService().sync({
        full: true,
        pruneMissing: true,
      });
      return NextResponse.json({ success: true, ...result });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Library synchronization failed." },
        { status: 500 },
      );
    }
  }

  if (body?.action === "metadata") {
    try {
      const result = await new MetadataSyncService().syncBatch(200);
      return NextResponse.json({ success: true, ...result });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Metadata synchronization failed." },
        { status: 500 },
      );
    }
  }

  if (body?.action === "embeddings") {
    const { data: missing, error } = await auth.admin
      .from("media_library")
      .select("id,title,series,overview,media_type")
      .is("embedding", null)
      .limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const embedder = new EmbeddingService();
    let processed = 0;
    for (const item of missing || []) {
      const description = [
        item.series || item.title,
        item.media_type === "movie" ? "Movie" : item.media_type === "anime" ? "Anime" : "TV Show",
        item.overview || "",
      ].filter(Boolean).join(" - ");
      try {
        const embedding = await embedder.getEmbedding(description);
        const { error: updateError } = await auth.admin
          .from("media_library")
          .update({ embedding })
          .eq("id", item.id);
        if (!updateError) processed++;
      } catch (embeddingError) {
        console.error("[Native API] Embedding generation failed:", embeddingError);
      }
    }
    const { count } = await auth.admin
      .from("media_library")
      .select("id", { count: "exact", head: true })
      .is("embedding", null);
    return NextResponse.json({
      success: true,
      processed,
      remaining: count || 0,
      message: processed === 0
        ? "All library files are already embedded."
        : `Generated ${processed} embeddings.`,
    });
  }

  if (!body?.mediaId) {
    return NextResponse.json({ error: "Missing media identifier." }, { status: 400 });
  }

  if (body.action === "progress") {
    const { error } = await auth.admin
      .from("user_progress")
      .upsert({
        profile_id: auth.user.id,
        media_id: body.mediaId,
        playback_position: Math.max(0, Math.floor(body.position || 0)),
        completed: Boolean(body.completed),
        last_watched: new Date().toISOString(),
      }, { onConflict: "profile_id,media_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body.action === "watchlist") {
    const { data: existing } = await auth.admin
      .from("watchlist")
      .select("id")
      .eq("user_id", auth.user.id)
      .eq("media_id", body.mediaId)
      .maybeSingle();

    if (existing) {
      const { error } = await auth.admin
        .from("watchlist")
        .delete()
        .eq("id", existing.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ status: "removed" });
    }

    const { error } = await auth.admin
      .from("watchlist")
      .insert({ user_id: auth.user.id, media_id: body.mediaId });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ status: "added" });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
