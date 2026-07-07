-- Migration to add folder_path column to media_library table
ALTER TABLE media_library ADD COLUMN IF NOT EXISTS folder_path TEXT DEFAULT '/';
