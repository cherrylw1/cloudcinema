import { createClient } from "@/clients/supabase/server";
import type { Media, MediaRepository } from "./index";
import type { Database } from "@/types/database";

type MediaRow = Database["public"]["Tables"]["media_library"]["Row"];

export class SupabaseMediaRepository implements MediaRepository {
  async getMediaList(options?: {
    type?: "movie" | "tv-show" | "anime";
    limit?: number;
    offset?: number;
    query?: string;
  }): Promise<Media[]> {
    const supabase = await createClient();
    const limit = options?.limit ?? 60;
    const offset = options?.offset ?? 0;

    let query = supabase
      .from("media_library")
      .select("*");

    if (options?.type) {
      query = query.eq("media_type", options.type);
    }

    if (options?.query) {
      const q = options.query;
      query = query.or(`title.ilike.%${q}%,series.ilike.%${q}%`);
    }

    // Sort alphabetically by title
    query = query.order("title", { ascending: true });

    // Apply pagination range (inclusive)
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return (data || []).map((row: MediaRow) => ({
      id: row.id,
      driveFileId: row.drive_file_id,
      title: row.title,
      series: row.series,
      season: row.season,
      episode: row.episode,
      mediaType: row.media_type,
      posterUrl: row.poster_url,
      backdropUrl: row.backdrop_url,
      runtime: row.runtime,
      fileSize: row.file_size,
      tmdbId: row.tmdb_id,
      mimeType: row.mime_type,
      dvProfile: row.dv_profile,
      audioCodec: row.audio_codec,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getMediaById(id: string): Promise<Media | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("media_library")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      driveFileId: data.drive_file_id,
      title: data.title,
      series: data.series,
      season: data.season,
      episode: data.episode,
      mediaType: data.media_type,
      posterUrl: data.poster_url,
      backdropUrl: data.backdrop_url,
      runtime: data.runtime,
      fileSize: data.file_size,
      tmdbId: data.tmdb_id,
      mimeType: data.mime_type,
      dvProfile: data.dv_profile,
      audioCodec: data.audio_codec,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
