import { createAdminClient } from "@/clients/supabase/admin";
import { parseAndCleanTitle } from "@/lib/title-parser";
import { TmdbService } from "./tmdb-service";

export interface MetadataSyncResult {
  processed: number;
  matched: number;
  unmatched: number;
  reclassifiedAnime: number;
}

export class MetadataSyncService {
  private adminClient;
  private tmdb;

  constructor() {
    this.adminClient = createAdminClient();
    this.tmdb = new TmdbService();
  }

  async syncBatch(batchSize = 200): Promise<MetadataSyncResult> {
    const result: MetadataSyncResult = {
      processed: 0,
      matched: 0,
      unmatched: 0,
      reclassifiedAnime: 0,
    };

    // Query up to batchSize rows where tmdb_id IS NULL
    const { data: batch, error } = await this.adminClient
      .from("media_library")
      .select("*")
      .is("tmdb_id", null)
      .limit(batchSize);

    if (error) {
      throw error;
    }

    if (!batch || batch.length === 0) {
      return result;
    }

    console.log(`[Metadata Sync] Processing batch of ${batch.length} unmatched media items...`);

    for (const row of batch) {
      result.processed++;
      let tmdbMatch = null;

      try {
        if (row.media_type === "movie") {
          const { cleanTitle, year } = parseAndCleanTitle(row.title);
          tmdbMatch = await this.tmdb.searchMovie(cleanTitle, year);
        } else if (row.media_type === "tv-show") {
          const tvQuery = row.series || row.title;
          tmdbMatch = await this.tmdb.searchTv(tvQuery);
        }
      } catch (err) {
        console.error(`[Metadata Sync] Failed TMDB search for row ID ${row.id} ("${row.title}"):`, err);
        result.unmatched++;
        continue;
      }

      if (tmdbMatch) {
        result.matched++;

        // Prepend TMDB base image paths
        const posterUrl = tmdbMatch.posterPath
          ? `https://image.tmdb.org/t/p/w500${tmdbMatch.posterPath}`
          : null;
        const backdropUrl = tmdbMatch.backdropPath
          ? `https://image.tmdb.org/t/p/w1280${tmdbMatch.backdropPath}`
          : null;

        // Reclassify to Anime if TV match's genres contain Animation (16) and language is Japanese ("ja")
        let updatedMediaType = row.media_type;
        if (row.media_type === "tv-show") {
          const isAnimation = tmdbMatch.genreIds.includes(16);
          const isJapanese = tmdbMatch.originalLanguage === "ja";
          if (isAnimation && isJapanese) {
            updatedMediaType = "anime";
            result.reclassifiedAnime++;
            console.log(`[Metadata Sync] Reclassifying "${row.title}" to anime`);
          }
        }

        const { error: updateError } = await this.adminClient
          .from("media_library")
          .update({
            tmdb_id: tmdbMatch.id,
            title: tmdbMatch.title,
            poster_url: posterUrl,
            backdrop_url: backdropUrl,
            overview: tmdbMatch.overview,
            runtime: tmdbMatch.runtime,
            media_type: updatedMediaType,
          })
          .eq("id", row.id);

        if (updateError) {
          console.error(`[Metadata Sync] Failed to update row ID ${row.id}:`, updateError);
        } else if (row.media_type === "tv-show" || row.media_type === "anime") {
          // For TV shows: propagate poster/backdrop/overview/tmdb_id to all sibling episodes
          const seriesKey = row.series || row.title;
          if (seriesKey) {
            const { error: siblingError } = await this.adminClient
              .from("media_library")
              .update({
                poster_url: posterUrl,
                backdrop_url: backdropUrl,
                overview: tmdbMatch.overview,
                tmdb_id: tmdbMatch.id,
                media_type: updatedMediaType,
              })
              .eq("series", seriesKey)
              .neq("id", row.id); // Don't update the current row again

            if (siblingError) {
              console.error(`[Metadata Sync] Failed to propagate to siblings for series "${seriesKey}":`, siblingError);
            } else {
              console.log(`[Metadata Sync] Propagated metadata to siblings for series "${seriesKey}"`);
            }
          }
        }
      } else {
        result.unmatched++;
        // Set sentinel value to mark as processed but unmatched
        const { error: updateError } = await this.adminClient
          .from("media_library")
          .update({
            tmdb_id: -1,
          })
          .eq("id", row.id);

        if (updateError) {
          console.error(`[Metadata Sync] Failed to update unmatched row ID ${row.id}:`, updateError);
        }
      }

      // 50ms pause to throttle outbound TMDB requests politely
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    console.log(`[Metadata Sync] Batch complete. Processed: ${result.processed}, Matched: ${result.matched}, Unmatched: ${result.unmatched}, Reclassified Anime: ${result.reclassifiedAnime}`);
    return result;
  }
}
