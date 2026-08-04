const OPTIONAL_RECOMMENDATION_COLUMNS = [
  "tmdb_popularity",
  "tmdb_vote_average",
  "tmdb_vote_count",
  "tmdb_genre_ids",
  "tmdb_original_language",
] as const;

export function isRecommendationMetadataSchemaError(error: unknown): boolean {
  const details = typeof error === "string"
    ? error
    : JSON.stringify(error instanceof Error ? { message: error.message } : error) ?? String(error);
  const mentionsOptionalColumn = OPTIONAL_RECOMMENDATION_COLUMNS.some((column) =>
    details.includes(column),
  );

  return mentionsOptionalColumn && /(column|schema cache|does not exist|could not find)/i.test(details);
}
