export interface UserProgress {
  id: string;
  profileId: string;
  mediaId: string;
  playbackPosition: number;
  completed: boolean;
  lastWatched: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProgressRepository {
  getProgress(profileId: string, mediaId: string): Promise<UserProgress | null>;
  saveProgress(progress: Omit<UserProgress, "id" | "lastWatched" | "createdAt" | "updatedAt">): Promise<void>;
}
