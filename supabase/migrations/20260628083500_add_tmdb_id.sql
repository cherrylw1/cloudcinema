-- Migration: Add tmdb_id column to public.media_library
ALTER TABLE public.media_library ADD COLUMN tmdb_id INTEGER;

-- Create index on tmdb_id to optimize sync checks
CREATE INDEX media_library_tmdb_id_idx ON public.media_library(tmdb_id);
