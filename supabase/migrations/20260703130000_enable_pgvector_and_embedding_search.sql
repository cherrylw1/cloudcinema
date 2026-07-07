-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column
ALTER TABLE public.media_library ADD COLUMN IF NOT EXISTS embedding vector(1536) DEFAULT NULL;

-- Create semantic similarity search lookup function (including drive_file_id)
CREATE OR REPLACE FUNCTION match_media (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  drive_file_id text,
  title text,
  series text,
  overview text,
  season int,
  episode int,
  media_type text,
  poster_url text,
  backdrop_url text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    media_library.id,
    media_library.drive_file_id,
    media_library.title,
    media_library.series,
    media_library.overview,
    media_library.season,
    media_library.episode,
    media_library.media_type,
    media_library.poster_url,
    media_library.backdrop_url,
    1 - (media_library.embedding <=> query_embedding) AS similarity
  FROM media_library
  WHERE media_library.embedding IS NOT NULL
    AND 1 - (media_library.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
