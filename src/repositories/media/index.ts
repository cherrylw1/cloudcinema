export interface Media {
  id: string;
  title: string;
  type: "movie" | "tv-show" | "anime";
  description?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  duration?: number;
  createdAt: string;
}

export interface MediaRepository {
  getMediaList(type?: "movie" | "tv-show" | "anime"): Promise<Media[]>;
  getMediaById(id: string): Promise<Media | null>;
}
