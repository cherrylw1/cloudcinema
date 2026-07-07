-- Add columns to cache recommendations on profile table and taste analysis on media library table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recommendations JSONB DEFAULT NULL;
ALTER TABLE public.media_library ADD COLUMN IF NOT EXISTS taste_analysis JSONB DEFAULT NULL;
