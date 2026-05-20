-- Add custom_samples column to resources table
ALTER TABLE resources 
ADD COLUMN IF NOT EXISTS custom_samples JSONB DEFAULT '[]'::jsonb;
