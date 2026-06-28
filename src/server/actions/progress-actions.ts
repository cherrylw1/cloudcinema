"use server";

import { createClient } from "@/clients/supabase/server";
import { SupabaseProgressRepository } from "@/repositories/progress/supabase-progress-repository";

export async function saveProgressAction(
  mediaId: string,
  playbackPosition: number,
  completed: boolean
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized: Cannot save progress without a valid session.");
  }

  const repository = new SupabaseProgressRepository();
  await repository.saveProgress({
    profileId: user.id,
    mediaId,
    playbackPosition,
    completed,
  });
}
