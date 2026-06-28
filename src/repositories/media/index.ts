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
  createdAt: string;
  updatedAt: string;
}

export interface MediaRepository {
  getMediaList(type?: "movie" | "tv-show" | "anime"): Promise<Media[]>;
  getMediaById(id: string): Promise<Media | null>;
}
