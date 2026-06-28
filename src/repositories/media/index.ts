export interface Media {
  id: string;
  driveFileId: string;
  title: string;
  series?: string | null;
  season?: number | null;
  episode?: number | null;
  mediaType: "movie" | "tv-show" | "anime";
  posterUrl?: string | null;
  backdropUrl?: string | null;
  runtime?: number | null;
  fileSize?: number | null;
  tmdbId?: number | null;
  mimeType?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MediaRepository {
  getMediaList(options?: {
    type?: "movie" | "tv-show" | "anime";
    limit?: number;
    offset?: number;
    query?: string;
  }): Promise<Media[]>;
  getMediaById(id: string): Promise<Media | null>;
}
