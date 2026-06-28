-- Migration: Add mime_type column to public.media_library
ALTER TABLE public.media_library ADD COLUMN mime_type TEXT;
