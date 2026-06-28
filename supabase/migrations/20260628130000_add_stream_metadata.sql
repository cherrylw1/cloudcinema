-- Migration: Add audio_streams and subtitle_streams JSONB columns to media_library.
-- These store all audio/subtitle track metadata from ffprobe enumeration,
-- enabling the multi-track audio selector and subtitle picker in the video player.
-- Existing dv_profile/audio_codec columns are kept as-is.
ALTER TABLE public.media_library
  ADD COLUMN audio_streams    JSONB,
  ADD COLUMN subtitle_streams JSONB;
