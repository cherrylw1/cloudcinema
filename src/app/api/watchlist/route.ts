import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  // 1. Verify user session inside the route
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

  // 3. Query watchlist joined with media_library
  const { data: watchlistItems, error: dbError } = await supabase
    .from("watchlist")
    .select("id, user_id, media_id, media_library(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(watchlistItems);
}

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { mediaId } = body;
  if (!mediaId) {
    return NextResponse.json({ error: "Missing mediaId." }, { status: 400 });
  }

  // 1. Verify user session inside the route
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

  // 3. Check if the user already has this mediaId in watchlist
  const { data: existing, error: checkError } = await supabase
    .from("watchlist")
    .select("id")
    .eq("user_id", user.id)
    .eq("media_id", mediaId)
    .maybeSingle();

  if (checkError) {
    return NextResponse.json({ error: checkError.message }, { status: 500 });
  }

  if (existing) {
    // Row exists -> Delete it
    const { error: deleteError } = await supabase
      .from("watchlist")
      .delete()
      .eq("user_id", user.id)
      .eq("media_id", mediaId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: "removed" });
  } else {
    // Row does not exist -> Insert it
    const { error: insertError } = await supabase
      .from("watchlist")
      .insert({
        user_id: user.id,
        media_id: mediaId,
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: "added" });
  }
}
