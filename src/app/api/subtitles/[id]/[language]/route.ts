import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";
import type { SubtitleTrack } from "@/repositories/media";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; language: string }> }
) {
  const { id, language } = await params;
  if (!id || !language) {
    return NextResponse.json({ error: "Missing media identifier or language." }, { status: 400 });
  }

  // 1. Verify user session inside the route (no redirect)
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

  // 3. Fetch subtitle tracks list from DB
  const { data: media, error: dbError } = await supabase
    .from("media_library")
    .select("subtitle_tracks")
    .eq("id", id)
    .maybeSingle();

  if (dbError || !media) {
    return NextResponse.json({ error: "Media file not found in library." }, { status: 404 });
  }

  const tracks = (media.subtitle_tracks as unknown as SubtitleTrack[]) || [];
  const track = tracks.find((t: SubtitleTrack) => t.language?.toLowerCase() === language.toLowerCase());

  if (!track || !track.content) {
    return NextResponse.json({ error: `Subtitle track for language "${language}" not found.` }, { status: 404 });
  }

  return new Response(track.content, {
    status: 200,
    headers: {
      "Content-Type": "text/vtt; charset=utf-8",
      "Cache-Control": "public, max-age=86400", // Cache subtitle for a day
    },
  });
}
