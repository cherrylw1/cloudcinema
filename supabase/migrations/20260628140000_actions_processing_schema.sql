-- Migration: Add actions processing columns to public.media_library
ALTER TABLE public.media_library
  ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN audio_variants JSONB,
  ADD COLUMN subtitle_tracks JSONB;
