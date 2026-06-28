export interface UserProgress {
  userId: string;
  mediaId: string;
  lastPositionSeconds: number;
  updatedAt: string;
  isCompleted: boolean;
}

export interface ProgressRepository {
  getProgress(userId: string, mediaId: string): Promise<UserProgress | null>;
  saveProgress(progress: Omit<UserProgress, "updatedAt">): Promise<void>;
}
