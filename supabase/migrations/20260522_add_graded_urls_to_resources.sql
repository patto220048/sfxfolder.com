-- Add graded_thumbnail_url and graded_preview_url columns to resources table
ALTER TABLE resources
ADD COLUMN IF NOT EXISTS graded_thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS graded_preview_url TEXT;
