-- =========================================================
-- Create sound_pack_reviews table and triggers
-- =========================================================

-- 1. Add columns to sound_packs if not exists
ALTER TABLE sound_packs ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0.00;
ALTER TABLE sound_packs ADD COLUMN IF NOT EXISTS review_count INT DEFAULT 0;

-- 2. Create sound_pack_reviews table
CREATE TABLE IF NOT EXISTS sound_pack_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_id UUID NOT NULL REFERENCES sound_packs(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, pack_id)
);

-- 3. Create rating sync trigger function
CREATE OR REPLACE FUNCTION sync_pack_ratings()
RETURNS TRIGGER AS $$
DECLARE
  v_pack_id UUID;
  v_avg_rating DECIMAL(3,2);
  v_count INT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_pack_id := OLD.pack_id;
  ELSE
    v_pack_id := NEW.pack_id;
  END IF;

  SELECT COALESCE(ROUND(AVG(rating), 2), 0.00), COUNT(*)
  INTO v_avg_rating, v_count
  FROM sound_pack_reviews
  WHERE pack_id = v_pack_id;

  UPDATE sound_packs
  SET average_rating = v_avg_rating,
      review_count = v_count,
      updated_at = now()
  WHERE id = v_pack_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create trigger
DROP TRIGGER IF EXISTS trigger_sync_pack_ratings ON sound_pack_reviews;
CREATE TRIGGER trigger_sync_pack_ratings
AFTER INSERT OR UPDATE OR DELETE ON sound_pack_reviews
FOR EACH ROW EXECUTE FUNCTION sync_pack_ratings();

-- 5. Enable RLS
ALTER TABLE sound_pack_reviews ENABLE ROW LEVEL SECURITY;

-- 6. Add RLS Policies
DROP POLICY IF EXISTS "Public read pack reviews" ON sound_pack_reviews;
CREATE POLICY "Public read pack reviews" ON sound_pack_reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own pack reviews if they have access" ON sound_pack_reviews;
CREATE POLICY "Users can insert own pack reviews if they have access" ON sound_pack_reviews
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    AND user_has_pack_access(auth.uid(), pack_id) = true
  );

DROP POLICY IF EXISTS "Users can update own reviews or admin" ON sound_pack_reviews;
CREATE POLICY "Users can update own reviews or admin" ON sound_pack_reviews
  FOR UPDATE USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can delete own reviews or admin" ON sound_pack_reviews;
CREATE POLICY "Users can delete own reviews or admin" ON sound_pack_reviews
  FOR DELETE USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
