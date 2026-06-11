-- =========================================================
-- Add mock ratings columns to sound_packs and composite calculation trigger
-- =========================================================

-- 1. Add columns to sound_packs
ALTER TABLE sound_packs ADD COLUMN IF NOT EXISTS real_average_rating DECIMAL(3,2) DEFAULT 0.00;
ALTER TABLE sound_packs ADD COLUMN IF NOT EXISTS real_review_count INT DEFAULT 0;
ALTER TABLE sound_packs ADD COLUMN IF NOT EXISTS mock_average_rating DECIMAL(3,2) DEFAULT 0.00;
ALTER TABLE sound_packs ADD COLUMN IF NOT EXISTS mock_review_count INT DEFAULT 0;

-- 2. Sync existing real rating values to real columns
UPDATE sound_packs SET 
  real_average_rating = COALESCE(average_rating, 0.00), 
  real_review_count = COALESCE(review_count, 0);

-- 3. Create function to calculate composite average_rating and review_count
CREATE OR REPLACE FUNCTION calculate_composite_ratings()
RETURNS TRIGGER AS $$
DECLARE
  v_total_count INT;
BEGIN
  v_total_count := COALESCE(NEW.real_review_count, 0) + COALESCE(NEW.mock_review_count, 0);
  
  IF v_total_count > 0 THEN
    NEW.review_count := v_total_count;
    NEW.average_rating := ROUND(
      (
        (COALESCE(NEW.real_average_rating, 0.00) * COALESCE(NEW.real_review_count, 0)) +
        (COALESCE(NEW.mock_average_rating, 0.00) * COALESCE(NEW.mock_review_count, 0))
      ) / v_total_count,
      2
    );
  ELSE
    NEW.review_count := 0;
    NEW.average_rating := 0.00;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create BEFORE INSERT OR UPDATE trigger on sound_packs
DROP TRIGGER IF EXISTS trigger_calculate_composite_ratings ON sound_packs;
CREATE TRIGGER trigger_calculate_composite_ratings
BEFORE INSERT OR UPDATE ON sound_packs
FOR EACH ROW EXECUTE FUNCTION calculate_composite_ratings();

-- 5. Update sync_pack_ratings trigger function to update real columns instead of display columns
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
  SET real_average_rating = v_avg_rating,
      real_review_count = v_count,
      updated_at = now()
  WHERE id = v_pack_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger composite calculation on all existing rows
UPDATE sound_packs SET updated_at = now();
