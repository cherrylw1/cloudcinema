export interface TmdbMetadata {
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  runtime: number | null;
  genreIds: number[];
  originalLanguage: string;
  id: number;
}

export class TmdbService {
  private apiToken: string;
  private baseUrl = "https://api.themoviedb.org/3";

  constructor() {
    this.apiToken = (process.env.TMDB_ACCESS_TOKEN || "").trim();
  }

  private async request<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    const searchParams = new URLSearchParams(params);
    const url = `${this.baseUrl}${endpoint}?${searchParams.toString()}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${this.apiToken}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`TMDB API request failed with status ${res.status}: ${errorText}`);
    }

    return await res.json() as T;
  }

  async searchMovie(query: string, year?: string): Promise<TmdbMetadata | null> {
    interface SearchResponse {
      results?: Array<{
        id: number;
        title: string;
        poster_path: string | null;
        backdrop_path: string | null;
        genre_ids: number[];
        original_language: string;
        release_date?: string;
      }>;
    }

    const params: Record<string, string> = { query };
    if (year) {
      params.primary_release_year = year;
    }

    const data = await this.request<SearchResponse>("/search/movie", params);
    const results = data.results || [];
    if (results.length === 0) {
      // If year match failed, retry search without year constraint
      if (year) {
        return this.searchMovie(query);
      }
      return null;
    }

    // Best match selection
    let bestMatch = results[0];
    if (year) {
      const match = results.find((r) => r.release_date?.startsWith(year));
      if (match) {
        bestMatch = match;
      }
    }

    // Fetch full movie details to retrieve the runtime
    let runtime: number | null = null;
    try {
      interface MovieDetailResponse {
        runtime?: number | null;
      }
      const details = await this.request<MovieDetailResponse>(`/movie/${bestMatch.id}`, {});
      runtime = details.runtime ?? null;
    } catch (err) {
      console.warn(`[TMDB] Failed to fetch details for movie ID ${bestMatch.id}:`, err);
    }

    return {
      id: bestMatch.id,
      title: bestMatch.title,
      posterPath: bestMatch.poster_path,
      backdropPath: bestMatch.backdrop_path,
      runtime,
      genreIds: bestMatch.genre_ids || [],
      originalLanguage: bestMatch.original_language,
    };
  }

  async searchTv(query: string): Promise<TmdbMetadata | null> {
    interface SearchResponse {
      results?: Array<{
        id: number;
        name: string;
        poster_path: string | null;
        backdrop_path: string | null;
        genre_ids: number[];
        original_language: string;
      }>;
    }

    const data = await this.request<SearchResponse>("/search/tv", { query });
    const results = data.results || [];
    if (results.length === 0) {
      return null;
    }

    const bestMatch = results[0];

    // Fetch full TV details to retrieve the episode run time
    let runtime: number | null = null;
    try {
      interface TvDetailResponse {
        episode_run_time?: number[] | null;
      }
      const details = await this.request<TvDetailResponse>(`/tv/${bestMatch.id}`, {});
      if (details.episode_run_time && details.episode_run_time.length > 0) {
        runtime = details.episode_run_time[0];
      }
    } catch (err) {
      console.warn(`[TMDB] Failed to fetch details for TV ID ${bestMatch.id}:`, err);
    }

    return {
      id: bestMatch.id,
      title: bestMatch.name,
      posterPath: bestMatch.poster_path,
      backdropPath: bestMatch.backdrop_path,
      runtime,
      genreIds: bestMatch.genre_ids || [],
      originalLanguage: bestMatch.original_language,
    };
  }
}
