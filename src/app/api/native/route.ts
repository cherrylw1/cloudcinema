import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/clients/supabase/admin";
import { generateStreamToken } from "@/lib/token";

export const dynamic = "force-dynamic";

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

export async function GET(request: NextRequest) {
  const auth = await approvedUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
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
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as {
    action?: string;
    mediaId?: string;
    position?: number;
    completed?: boolean;
  } | null;
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
