import { createAdminClient } from "@/clients/supabase/admin";
import { parseAndCleanTitle } from "@/lib/title-parser";
import { TmdbService, type TmdbMetadata } from "./tmdb-service";

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

    let query = this.adminClient
      .from("media_library")
      .select("id, title, series, media_type")
      .in("media_type", ["movie", "tv-show", "anime"])
      .limit(batchSize);

    // -1 is the existing sentinel for a previous no-match. Retry it when the
    // user explicitly starts a fresh metadata run, but do not count it as an
    // endless pending queue for the current run.
    query = options?.retryUnmatched === false
      ? query.is("tmdb_id", null)
      : query.or("tmdb_id.is.null,tmdb_id.eq.-1");

    const { data: rawBatch, error } = await query;
    if (error) throw error;

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

    const { count: remaining, error: remainingError } = await this.adminClient
      .from("media_library")
      .select("id", { count: "exact", head: true })
      .in("media_type", ["movie", "tv-show", "anime"])
      .is("tmdb_id", null);

    if (remainingError) throw remainingError;
    result.remaining = remaining ?? 0;

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

    const update = {
      tmdb_id: tmdbMatch.id,
      title: tmdbMatch.title,
      poster_url: posterUrl,
      backdrop_url: backdropUrl,
      overview: tmdbMatch.overview,
      runtime: tmdbMatch.runtime,
      ...(updatedMediaType ? { media_type: updatedMediaType } : {}),
    };

    if (group.type === "tv" && group.rows[0].series) {
      const { error } = await this.adminClient
        .from("media_library")
        .update(update)
        .eq("series", group.rows[0].series)
        .in("media_type", ["tv-show", "anime"]);
      if (error) throw error;
    } else {
      const { error } = await this.adminClient
        .from("media_library")
        .update(update)
        .in("id", group.rows.map((row) => row.id));
      if (error) throw error;
    }

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
