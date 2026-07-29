import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/clients/supabase/server";
import { env } from "@/config/env";

export const dynamic = "force-dynamic";

interface BrowserPreparation {
  state: "queued" | "processing" | "failed";
  requestedAt: string;
  attempt: number;
  delivery?: "queue";
}

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
  const existingStreams = media.audio_streams;
  const streamMetadata = (Array.isArray(existingStreams)
    ? { version: 2, tracks: existingStreams }
    : existingStreams || { version: 2, tracks: [] }) as {
    browserHls?: unknown;
    browserPreparation?: BrowserPreparation;
    tracks?: unknown[];
    version?: number;
  };
  const browserPlaybackReady = Boolean(streamMetadata?.browserHls);
  const preparation = streamMetadata.browserPreparation;
  const hasActiveBrowserJob =
    preparation?.state === "queued" || preparation?.state === "processing";
  const attemptsExhausted =
    preparation?.delivery === "queue" &&
    preparation.state === "failed" &&
    preparation.attempt >= 2;

  // 4. Queue browser preparation when HLS is missing. Existing processed MP4s
  // are reused by the runner and remain untouched for external players.
  if (!browserPlaybackReady && !hasActiveBrowserJob && !attemptsExhausted) {
    try {
      // Queue first; the worker atomically claims queued jobs as processing.
      const browserPreparation: BrowserPreparation = {
        state: "queued",
        requestedAt: new Date().toISOString(),
        attempt: (preparation?.attempt || 0) + 1,
        delivery: "queue",
      };
      const { error: updateError } = await supabase
        .from("media_library")
        .update({
          processing_status: "queued",
          audio_streams: {
            ...streamMetadata,
            version: 2,
            tracks: streamMetadata.tracks || [],
            browserPreparation,
          },
        })
        .eq("id", id);

      if (updateError) throw updateError;
      status = "queued";

      // Instant dispatch is an optimization. The scheduled workflow also drains
      // this queue, so an expired or missing PAT cannot strand browser playback.
      if (env.githubPat) {
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
          },
        );
        if (!githubRes.ok) {
          console.error(
            `[Prepare API] Instant dispatch failed (${githubRes.status}); scheduled queue will retry.`,
          );
        }
      } else {
        console.warn("[Prepare API] GITHUB_PAT is unavailable; using scheduled queue.");
      }

    } catch (err) {
      console.error("[Prepare API] Exception during dispatch:", err);
      const failedPreparation: BrowserPreparation = {
        state: "failed",
        requestedAt: new Date().toISOString(),
        attempt: (preparation?.attempt || 0) + 1,
      };
      await supabase
        .from("media_library")
        .update({
          processing_status: "failed",
          audio_streams: {
            ...streamMetadata,
            version: 2,
            tracks: streamMetadata.tracks || [],
            browserPreparation: failedPreparation,
          },
        })
        .eq("id", id);

      return NextResponse.json({ error: "Internal server error during dispatch." }, { status: 500 });
    }
  }

  if (media) {
    media.processing_status = status;
  }
  return NextResponse.json({
    status: attemptsExhausted ? "failed" : status,
    browserPlaybackReady,
    media,
  });
}
