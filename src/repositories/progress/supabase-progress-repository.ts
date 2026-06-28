import { createClient } from "@/clients/supabase/server";
import type { ProgressRepository, UserProgress } from "./index";

export class SupabaseProgressRepository implements ProgressRepository {
  async getProgress(profileId: string, mediaId: string): Promise<UserProgress | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("user_progress")
      .select("*")
      .eq("profile_id", profileId)
      .eq("media_id", mediaId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      profileId: data.profile_id,
      mediaId: data.media_id,
      playbackPosition: data.playback_position,
      completed: data.completed,
      lastWatched: data.last_watched,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async saveProgress(
    progress: Omit<UserProgress, "id" | "lastWatched" | "createdAt" | "updatedAt">
  ): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from("user_progress")
      .upsert(
        {
          profile_id: progress.profileId,
          media_id: progress.mediaId,
          playback_position: Math.floor(progress.playbackPosition),
          completed: progress.completed,
          last_watched: new Date().toISOString(),
        },
        {
          onConflict: "profile_id,media_id",
        }
      );

    if (error) {
      throw error;
    }
  }
}
