-- Migration: Add dv_profile and audio_codec columns to public.media_library
ALTER TABLE public.media_library 
  ADD COLUMN dv_profile INTEGER,
  ADD COLUMN audio_codec TEXT;
