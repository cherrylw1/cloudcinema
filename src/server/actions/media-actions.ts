"use server";

import { SupabaseMediaRepository } from "@/repositories/media/supabase-media-repository";
import type { Media } from "@/repositories/media";

export async function getMediaListAction(options?: {
  type?: "movie" | "tv-show" | "anime";
  limit?: number;
  offset?: number;
}): Promise<Media[]> {
  try {
    const repository = new SupabaseMediaRepository();
    return await repository.getMediaList(options);
  } catch (err) {
    console.error("Failed to fetch media list:", err);
    throw new Error("Failed to retrieve media library assets.");
  }
}
