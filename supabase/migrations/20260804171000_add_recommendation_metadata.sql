alter table public.media_library
  add column if not exists tmdb_popularity numeric,
  add column if not exists tmdb_vote_average numeric,
  add column if not exists tmdb_vote_count integer,
  add column if not exists tmdb_genre_ids jsonb,
  add column if not exists tmdb_original_language text;

create index if not exists media_library_tmdb_popularity_idx
  on public.media_library(tmdb_popularity desc nulls last);

create index if not exists media_library_tmdb_vote_average_idx
  on public.media_library(tmdb_vote_average desc nulls last);
