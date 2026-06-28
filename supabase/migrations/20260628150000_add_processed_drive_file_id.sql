-- Migration: Add processed_drive_file_id column
ALTER TABLE public.media_library
  ADD COLUMN processed_drive_file_id TEXT;
