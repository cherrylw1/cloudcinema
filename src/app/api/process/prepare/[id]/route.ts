import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";
import { env } from "@/config/env";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing media identifier." }, { status: 400 });
  }

  // 1. Verify user session inside the route
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  // 2. Verify the user is approved (is_approved = true)
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_approved")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_approved) {
    return NextResponse.json({ error: "Approval pending." }, { status: 403 });
  }

  // 3. Fetch the current media library record from Supabase
  const { data: media, error: dbError } = await supabase
    .from("media_library")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (dbError || !media) {
    return NextResponse.json({ error: "Media file not found in library." }, { status: 404 });
  }

  let status = media.processing_status || "none";

  // 4. Trigger GitHub Actions workflow if the status is 'none'
  if (status === "none") {
    if (!env.githubPat) {
      console.error("[Prepare API] Trigger failed: GITHUB_PAT env variable is not set.");
      return NextResponse.json(
        { error: "GitHub integration is not configured on the server." },
        { status: 500 }
      );
    }

    console.log(`[Prepare API] Triggering GitHub Actions workflow for Media: ${id}`);
    
    try {
      // First update status in database to 'processing' to prevent race conditions
      const { error: updateError } = await supabase
        .from("media_library")
        .update({ processing_status: "processing" })
        .eq("id", id);

      if (updateError) throw updateError;

      const githubRes = await fetch(
        "https://api.github.com/repos/cherrylw1/cloudcinema/actions/workflows/process-media.yml/dispatches",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.githubPat}`,
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json",
            "User-Agent": "CloudCinema-App",
          },
          body: JSON.stringify({
            ref: "main",
            inputs: {
              media_id: id,
            },
          }),
        }
      );

      if (!githubRes.ok) {
        const errorText = await githubRes.text();
        console.error(`[Prepare API] GitHub dispatch failed: Status ${githubRes.status} - ${errorText}`);
        
        // Revert status to none so user can retry
        await supabase
          .from("media_library")
          .update({ processing_status: "none" })
          .eq("id", id);

        return NextResponse.json(
          { error: "Failed to dispatch media processing job." },
          { status: 502 }
        );
      }

      status = "processing";
      console.log(`[Prepare API] Successfully dispatched workflow for Media: ${id}`);
    } catch (err) {
      console.error("[Prepare API] Exception during dispatch:", err);
      // Revert status
      await supabase
        .from("media_library")
        .update({ processing_status: "none" })
        .eq("id", id);

      return NextResponse.json({ error: "Internal server error during dispatch." }, { status: 500 });
    }
  }

  if (media) {
    media.processing_status = status;
  }
  return NextResponse.json({ status, media });
}
