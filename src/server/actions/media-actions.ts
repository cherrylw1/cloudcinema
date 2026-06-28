"use server";

import { SupabaseMediaRepository } from "@/repositories/media/supabase-media-repository";
import type { Media } from "@/repositories/media";

import { createClient } from "@/clients/supabase/server";

export async function getMediaListAction(options?: {
  type?: "movie" | "tv-show" | "anime";
  limit?: number;
  offset?: number;
  query?: string;
}): Promise<Media[]> {
  try {
    const repository = new SupabaseMediaRepository();
    return await repository.getMediaList(options);
  } catch (err) {
    console.error("Failed to fetch media list:", err);
    throw new Error("Failed to retrieve media library assets.");
  }
}

export async function getMediaStatsAction() {
  try {
    const supabase = await createClient();

    const { count: dv5Count, error: err1 } = await supabase
      .from("media_library")
      .select("*", { count: "exact", head: true })
      .eq("dv_profile", 5);

    if (err1) throw err1;

    const { count: dv78Count, error: err2 } = await supabase
      .from("media_library")
      .select("*", { count: "exact", head: true })
      .in("dv_profile", [7, 8]);

    if (err2) throw err2;

    return {
      dv5Count: dv5Count || 0,
      dv78Count: dv78Count || 0,
    };
  } catch (err) {
    console.error("Failed to get media stats:", err);
    return { dv5Count: 0, dv78Count: 0 };
  }
}
