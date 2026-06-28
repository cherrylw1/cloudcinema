export interface MediaMetadata {
  mediaId: string;
  tmdbId?: string;
  imdbId?: string;
  rating?: number;
  releaseDate?: string;
  genres?: string[];
  cast?: string[];
}

export interface MetadataRepository {
  getMetadata(mediaId: string): Promise<MediaMetadata | null>;
  saveMetadata(metadata: MediaMetadata): Promise<void>;
}
