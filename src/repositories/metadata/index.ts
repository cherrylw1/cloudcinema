export interface MediaMetadata {
  mediaId: string;
  tmdbId?: string;
  imdbId?: string;
  rating?: number;
  releaseDate?: string;
  genres?: string[];
  cast?: string[];
}

export interface IntroMeta {
  id: string;
  mediaId: string;
  introStart: number;
  introEnd: number;
  updatedAt: string;
}

export interface MetadataRepository {
  getMetadata(mediaId: string): Promise<MediaMetadata | null>;
  saveMetadata(metadata: MediaMetadata): Promise<void>;
  getIntroMeta(mediaId: string): Promise<IntroMeta | null>;
  saveIntroMeta(introMeta: Omit<IntroMeta, "id" | "updatedAt">): Promise<void>;
}
