-- Migration: Add view_count to sound_packs and function to increment it
ALTER TABLE sound_packs ADD COLUMN IF NOT EXISTS view_count INT DEFAULT 0;

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_pack_view_count(p_pack_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE sound_packs 
  SET view_count = COALESCE(view_count, 0) + 1 
  WHERE id = p_pack_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
