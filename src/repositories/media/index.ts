// Shared stream metadata types — used by both the repository and VideoPlayer
export interface AudioStream {
  index: number;       // 0-based among audio streams: ffmpeg -map 0:a:{index}
  language: string | null;
  codec: string | null;
  channels: number | null;
}

export interface SubtitleStream {
  index: number;       // 0-based among subtitle streams: ffmpeg -map 0:s:{index}
  language: string | null;
  codec: string | null;
}

export interface AudioVariant {
  language: string;
  driveFileId: string;
}

export interface SubtitleTrack {
  id?: string;
  language: string;
  label?: string;
  forced?: boolean;
  content: string; // Raw WebVTT text content
}

export interface HlsRendition {
  driveFileId: string;
  fileSize: number;
  playlist: string;
  r2Key?: string;
  r2Etag?: string;
}

export interface HlsAudioRendition extends HlsRendition {
  index: number;
  language: string;
  label: string;
  channels: number;
  default: boolean;
}

export interface HlsManifest {
  version: 1;
  video: HlsRendition & {
    codec: string;
    width: number | null;
    height: number | null;
    bandwidth: number;
  };
  audio: HlsAudioRendition[];
}

export interface R2Original {
  key: string;
  driveFileId: string;
  fileSize: number;
  contentType: string;
  r2Etag?: string;
}

export interface StreamMetadata {
  version: 2;
  tracks: AudioStream[];
  browserHls: HlsManifest;
  r2Original?: R2Original;
}

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
  overview?: string | null;
  runtime?: number | null;
  fileSize?: number | null;
  tmdbId?: number | null;
  mimeType?: string | null;
  dvProfile?: number | null;
  audioCodec?: string | null;
  audioStreams?: AudioStream[] | null;
  subtitleStreams?: SubtitleStream[] | null;
  processingStatus: string;
  audioVariants?: AudioVariant[] | null;
  subtitleTracks?: SubtitleTrack[] | null;
  hlsManifest?: HlsManifest | null;
  processedDriveFileId?: string | null;
  folderPath?: string;
  isGroup?: boolean;
  episodeIds?: string[];
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
