-- =========================================================
-- Add free_for_premium column to sound_packs
-- Update user_has_pack_access function to support sold-separately packs
-- =========================================================

-- 1. Add column to sound_packs if not exists
ALTER TABLE sound_packs ADD COLUMN IF NOT EXISTS free_for_premium BOOLEAN DEFAULT true;

-- 2. Update user_has_pack_access RPC function
CREATE OR REPLACE FUNCTION user_has_pack_access(p_user_id UUID, p_pack_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    -- Has purchased this pack
    SELECT 1 FROM pack_purchases
    WHERE user_id = p_user_id AND pack_id = p_pack_id AND status = 'completed'
  ) OR EXISTS (
    -- Is admin or active premium subscriber (who gets access only if the pack is free for premium)
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND (
      role = 'admin' OR (
        subscription_status IN ('active', 'suspended', 'cancelled')
        AND subscription_expires_at IS NOT NULL
        AND subscription_expires_at > now()
        AND EXISTS (
          SELECT 1 FROM sound_packs
          WHERE id = p_pack_id AND free_for_premium = true
        )
      )
    )
  );
$$ LANGUAGE sql SECURITY DEFINER;
