import { createAdminClient } from "@/clients/supabase/admin";
import { parseAndCleanTitle } from "@/lib/title-parser";
import { isRecommendationMetadataSchemaError } from "@/lib/recommendation-metadata";
import { TmdbService, type TmdbMetadata } from "./tmdb-service";
import type { Database } from "@/types/database";

export interface MetadataSyncResult {
  processed: number;
  matched: number;
  unmatched: number;
  reclassifiedAnime: number;
  remaining: number;
}

type MetadataRow = {
  id: string;
  title: string;
  series: string | null;
  media_type: "movie" | "tv-show" | "anime";
};

type LookupGroup = {
  key: string;
  query: string;
  year?: string;
  type: "movie" | "tv";
  rows: MetadataRow[];
};

const LOOKUP_CONCURRENCY = 6;

export class MetadataSyncService {
  private adminClient;
  private tmdb;

  constructor() {
    this.adminClient = createAdminClient();
    this.tmdb = new TmdbService();
  }

  async syncBatch(batchSize = 200, options?: { retryUnmatched?: boolean }): Promise<MetadataSyncResult> {
    const result: MetadataSyncResult = {
      processed: 0,
      matched: 0,
      unmatched: 0,
      reclassifiedAnime: 0,
      remaining: 0,
    };

    const baseQuery = () => this.adminClient
      .from("media_library")
      .select("id, title, series, media_type")
      .in("media_type", ["movie", "tv-show", "anime"]);

    // -1 is the existing sentinel for a previous no-match. Retry it when the
    // user explicitly starts a fresh metadata run, but do not count it as an
    // endless pending queue for the current run.
    const missingQuery = options?.retryUnmatched === false
      ? baseQuery().is("tmdb_id", null).limit(batchSize)
      : baseQuery().or("tmdb_id.is.null,tmdb_id.eq.-1").limit(batchSize);

    const { data: missingRows, error: missingError } = await missingQuery;
    if (missingError) throw missingError;

    let rawBatch = missingRows || [];
    if (rawBatch.length < batchSize) {
      const { data: enrichmentRows, error: enrichmentError } = await baseQuery()
        .not("tmdb_id", "is", null)
        .neq("tmdb_id", -1)
        .is("tmdb_popularity", null)
        .limit(batchSize - rawBatch.length);

      if (!enrichmentError) {
        rawBatch = [...rawBatch, ...(enrichmentRows || [])];
      }
    }

    const batch = (rawBatch || []) as MetadataRow[];
    result.processed = batch.length;

    if (batch.length > 0) {
      const groups = this.buildLookupGroups(batch);
      console.log(`[Metadata Sync] Processing ${batch.length} files in ${groups.length} TMDB lookups...`);

      let cursor = 0;
      const processNext = async () => {
        while (cursor < groups.length) {
          const group = groups[cursor++];
          await this.processGroup(group, result);
        }
      };

      await Promise.all(
        Array.from(
          { length: Math.min(LOOKUP_CONCURRENCY, groups.length) },
          () => processNext(),
        ),
      );
    }

    const { count: missingCount, error: missingCountError } = await this.adminClient
      .from("media_library")
      .select("id", { count: "exact", head: true })
      .in("media_type", ["movie", "tv-show", "anime"])
      .is("tmdb_id", null);

    if (missingCountError) throw missingCountError;

    const { count: enrichmentCount, error: enrichmentCountError } = await this.adminClient
      .from("media_library")
      .select("id", { count: "exact", head: true })
      .in("media_type", ["movie", "tv-show", "anime"])
      .not("tmdb_id", "is", null)
      .neq("tmdb_id", -1)
      .is("tmdb_popularity", null);

    if (enrichmentCountError) {
      result.remaining = missingCount ?? 0;
    } else {
      result.remaining = (missingCount ?? 0) + (enrichmentCount ?? 0);
    }

    console.log(
      `[Metadata Sync] Complete. Processed: ${result.processed}, ` +
      `Matched: ${result.matched}, Unmatched: ${result.unmatched}, ` +
      `Remaining: ${result.remaining}, Anime: ${result.reclassifiedAnime}`,
    );

    return result;
  }

  private buildLookupGroups(rows: MetadataRow[]): LookupGroup[] {
    const groups = new Map<string, LookupGroup>();

    for (const row of rows) {
      if (row.media_type === "movie") {
        const { cleanTitle, year } = parseAndCleanTitle(row.title);
        const key = `movie:${cleanTitle.toLowerCase()}:${year || ""}`;
        const group = groups.get(key) || {
          key,
          query: cleanTitle,
          year,
          type: "movie",
          rows: [],
        };
        group.rows.push(row);
        groups.set(key, group);
        continue;
      }

      const parsed = parseAndCleanTitle(row.series || row.title);
      const query = parsed.cleanTitle;
      const key = `tv:${query.toLowerCase()}`;
      const group = groups.get(key) || {
        key,
        query,
        type: "tv",
        rows: [],
      };
      group.rows.push(row);
      groups.set(key, group);
    }

    return Array.from(groups.values());
  }

  private async processGroup(group: LookupGroup, result: MetadataSyncResult) {
    let tmdbMatch: TmdbMetadata | null = null;

    try {
      tmdbMatch = group.type === "movie"
        ? await this.tmdb.searchMovie(group.query, group.year)
        : await this.tmdb.searchTv(group.query);
    } catch (err) {
      console.error(`[Metadata Sync] TMDB lookup failed for "${group.query}":`, err);
    }

    if (!tmdbMatch) {
      result.unmatched += group.rows.length;
      await this.markUnmatched(group.rows);
      return;
    }

    const posterUrl = tmdbMatch.posterPath
      ? `https://image.tmdb.org/t/p/w500${tmdbMatch.posterPath}`
      : null;
    const backdropUrl = tmdbMatch.backdropPath
      ? `https://image.tmdb.org/t/p/w1280${tmdbMatch.backdropPath}`
      : null;
    const isAnime = group.type === "tv" &&
      tmdbMatch.genreIds.includes(16) &&
      tmdbMatch.originalLanguage === "ja";
    const updatedMediaType = isAnime ? "anime" : undefined;

    const baseUpdate: Database["public"]["Tables"]["media_library"]["Update"] = {
      tmdb_id: tmdbMatch.id,
      title: tmdbMatch.title,
      poster_url: posterUrl,
      backdrop_url: backdropUrl,
      overview: tmdbMatch.overview,
      runtime: tmdbMatch.runtime,
      ...(updatedMediaType ? { media_type: updatedMediaType } : {}),
    };
    const update: Database["public"]["Tables"]["media_library"]["Update"] = {
      ...baseUpdate,
      tmdb_popularity: tmdbMatch.popularity,
      tmdb_vote_average: tmdbMatch.voteAverage,
      tmdb_vote_count: tmdbMatch.voteCount,
      tmdb_genre_ids: tmdbMatch.genreIds,
      tmdb_original_language: tmdbMatch.originalLanguage,
    };

    const applyUpdate = (payload: Database["public"]["Tables"]["media_library"]["Update"]) => {
      if (group.type === "tv" && group.rows[0].series) {
        return this.adminClient
          .from("media_library")
          .update(payload)
          .eq("series", group.rows[0].series)
          .in("media_type", ["tv-show", "anime"]);
      }

      return this.adminClient
        .from("media_library")
        .update(payload)
        .in("id", group.rows.map((row) => row.id));
    };

    let updateResponse = await applyUpdate(update);
    if (updateResponse.error && isRecommendationMetadataSchemaError(updateResponse.error)) {
      console.warn("[Metadata Sync] Ranking columns are unavailable; saving core metadata only.");
      updateResponse = await applyUpdate(baseUpdate);
    }

    if (updateResponse.error) throw updateResponse.error;

    result.matched += group.rows.length;
    if (isAnime) result.reclassifiedAnime += group.rows.length;
  }

  private async markUnmatched(rows: MetadataRow[]) {
    const { error } = await this.adminClient
      .from("media_library")
      .update({ tmdb_id: -1 })
      .in("id", rows.map((row) => row.id));
    if (error) throw error;
  }
}
