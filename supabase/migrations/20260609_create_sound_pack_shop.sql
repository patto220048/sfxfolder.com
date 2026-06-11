-- =========================================
-- SFXFolder.com — Sound Pack Shop
-- Migration: Create Shop Tables
-- =========================================

-- 1. SOUND PACKS — Main pack/product table
CREATE TABLE IF NOT EXISTS sound_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  short_description TEXT,
  cover_image TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  original_price DECIMAL(10,2),
  category_id TEXT REFERENCES categories(slug) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  item_count INT DEFAULT 0,
  total_size BIGINT DEFAULT 0,
  purchase_count INT DEFAULT 0,
  zip_storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_featured BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sound_packs_slug ON sound_packs(slug);
CREATE INDEX IF NOT EXISTS idx_sound_packs_status ON sound_packs(status);
CREATE INDEX IF NOT EXISTS idx_sound_packs_category ON sound_packs(category_id);
CREATE INDEX IF NOT EXISTS idx_sound_packs_featured ON sound_packs(is_featured) WHERE is_featured = true;

-- 2. SOUND PACK ITEMS — Links packs to resources or exclusive files
CREATE TABLE IF NOT EXISTS sound_pack_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES sound_packs(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES resources(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_format TEXT,
  file_size BIGINT DEFAULT 0,
  storage_path TEXT,
  preview_url TEXT,
  is_previewable BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pack_items_pack ON sound_pack_items(pack_id);
CREATE INDEX IF NOT EXISTS idx_pack_items_resource ON sound_pack_items(resource_id);

-- Unique: one resource per pack (when resource_id is not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pack_items_unique_resource
  ON sound_pack_items(pack_id, resource_id) WHERE resource_id IS NOT NULL;

-- 3. COUPONS — Discount code system
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL,
  min_purchase DECIMAL(10,2) DEFAULT 0,
  max_discount DECIMAL(10,2),
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  max_uses INT,
  used_count INT DEFAULT 0,
  max_uses_per_user INT DEFAULT 1,
  applicable_pack_ids UUID[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active) WHERE is_active = true;

-- 4. PACK PURCHASES — Purchase history
CREATE TABLE IF NOT EXISTS pack_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_id UUID NOT NULL REFERENCES sound_packs(id) ON DELETE RESTRICT,
  paypal_order_id TEXT UNIQUE,
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded')),
  purchased_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_user_pack
  ON pack_purchases(user_id, pack_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON pack_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_pack ON pack_purchases(pack_id);
CREATE INDEX IF NOT EXISTS idx_purchases_paypal ON pack_purchases(paypal_order_id);

-- 5. PACK DOWNLOAD LOG — Tracking downloads
CREATE TABLE IF NOT EXISTS pack_download_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_id UUID NOT NULL REFERENCES sound_packs(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_download_log_user ON pack_download_log(user_id);
CREATE INDEX IF NOT EXISTS idx_download_log_pack ON pack_download_log(pack_id);

-- =========================================
-- TRIGGERS
-- =========================================

-- Auto-update updated_at on sound_packs
CREATE OR REPLACE FUNCTION handle_pack_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_pack_updated_at
  BEFORE UPDATE ON sound_packs
  FOR EACH ROW EXECUTE FUNCTION handle_pack_updated_at();

-- Auto-sync item_count and total_size when items change
CREATE OR REPLACE FUNCTION sync_pack_stats()
RETURNS TRIGGER AS $$
DECLARE
  target_pack_id UUID;
BEGIN
  -- Determine which pack to update
  IF TG_OP = 'DELETE' THEN
    target_pack_id := OLD.pack_id;
  ELSE
    target_pack_id := NEW.pack_id;
  END IF;

  -- Update pack stats
  UPDATE sound_packs SET
    item_count = (SELECT COUNT(*) FROM sound_pack_items WHERE pack_id = target_pack_id),
    total_size = COALESCE((SELECT SUM(file_size) FROM sound_pack_items WHERE pack_id = target_pack_id), 0)
  WHERE id = target_pack_id;

  -- If pack_id changed (item moved), update old pack too
  IF TG_OP = 'UPDATE' AND OLD.pack_id != NEW.pack_id THEN
    UPDATE sound_packs SET
      item_count = (SELECT COUNT(*) FROM sound_pack_items WHERE pack_id = OLD.pack_id),
      total_size = COALESCE((SELECT SUM(file_size) FROM sound_pack_items WHERE pack_id = OLD.pack_id), 0)
    WHERE id = OLD.pack_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_pack_stats
  AFTER INSERT OR UPDATE OR DELETE ON sound_pack_items
  FOR EACH ROW EXECUTE FUNCTION sync_pack_stats();

-- =========================================
-- RLS POLICIES
-- =========================================

ALTER TABLE sound_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sound_pack_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_download_log ENABLE ROW LEVEL SECURITY;

-- sound_packs: Public read published, admin full CRUD
CREATE POLICY "Public read published packs"
  ON sound_packs FOR SELECT
  USING (status = 'published');

CREATE POLICY "Admin full access packs"
  ON sound_packs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- sound_pack_items: Public read items of published packs + admin full
CREATE POLICY "Public read items of published packs"
  ON sound_pack_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM sound_packs WHERE id = pack_id AND status = 'published'
  ));

CREATE POLICY "Admin full access pack items"
  ON sound_pack_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- pack_purchases: Users read own purchases
CREATE POLICY "Users read own purchases"
  ON pack_purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages purchases"
  ON pack_purchases FOR ALL
  USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

-- coupons: Public read active coupons (server validates details)
CREATE POLICY "Public read active coupons"
  ON coupons FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admin full access coupons"
  ON coupons FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- pack_download_log: Users read own
CREATE POLICY "Users read own download log"
  ON pack_download_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin full access download log"
  ON pack_download_log FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- =========================================
-- RPC FUNCTIONS
-- =========================================

-- Check if user has access to a pack (purchased OR premium subscriber OR admin)
CREATE OR REPLACE FUNCTION user_has_pack_access(p_user_id UUID, p_pack_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    -- Has purchased this pack
    SELECT 1 FROM pack_purchases
    WHERE user_id = p_user_id AND pack_id = p_pack_id AND status = 'completed'
  ) OR EXISTS (
    -- Is admin or active premium subscriber
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND (
      role = 'admin' OR (
        subscription_status IN ('active', 'suspended', 'cancelled')
        AND subscription_expires_at IS NOT NULL
        AND subscription_expires_at > now()
      )
    )
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Validate and calculate coupon discount
CREATE OR REPLACE FUNCTION validate_coupon(
  p_code TEXT,
  p_pack_id UUID,
  p_user_id UUID
)
RETURNS TABLE(
  coupon_id UUID,
  discount_type TEXT,
  discount_value DECIMAL,
  max_discount DECIMAL,
  final_price DECIMAL,
  error_message TEXT
) AS $$
DECLARE
  v_coupon RECORD;
  v_pack_price DECIMAL;
  v_user_usage INT;
  v_discount DECIMAL;
BEGIN
  -- Get coupon
  SELECT * INTO v_coupon FROM coupons c
  WHERE UPPER(c.code) = UPPER(p_code) AND c.is_active = true;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, 'Invalid coupon code'::TEXT;
    RETURN;
  END IF;

  -- Check date range
  IF v_coupon.valid_from IS NOT NULL AND now() < v_coupon.valid_from THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, 'Coupon is not yet active'::TEXT;
    RETURN;
  END IF;

  IF v_coupon.valid_until IS NOT NULL AND now() > v_coupon.valid_until THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, 'Coupon has expired'::TEXT;
    RETURN;
  END IF;

  -- Check total usage limit
  IF v_coupon.max_uses IS NOT NULL AND v_coupon.used_count >= v_coupon.max_uses THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, 'Coupon usage limit reached'::TEXT;
    RETURN;
  END IF;

  -- Check per-user usage limit
  SELECT COUNT(*) INTO v_user_usage FROM pack_purchases
  WHERE user_id = p_user_id AND coupon_id = v_coupon.id;

  IF v_coupon.max_uses_per_user IS NOT NULL AND v_user_usage >= v_coupon.max_uses_per_user THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, 'You have already used this coupon'::TEXT;
    RETURN;
  END IF;

  -- Check applicable packs
  IF v_coupon.applicable_pack_ids IS NOT NULL AND array_length(v_coupon.applicable_pack_ids, 1) > 0 THEN
    IF NOT (p_pack_id = ANY(v_coupon.applicable_pack_ids)) THEN
      RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, 'Coupon is not valid for this pack'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Get pack price
  SELECT price INTO v_pack_price FROM sound_packs WHERE id = p_pack_id;

  IF v_pack_price IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, 'Pack not found'::TEXT;
    RETURN;
  END IF;

  -- Check minimum purchase
  IF v_coupon.min_purchase IS NOT NULL AND v_pack_price < v_coupon.min_purchase THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL,
      ('Minimum purchase is $' || v_coupon.min_purchase::TEXT)::TEXT;
    RETURN;
  END IF;

  -- Calculate discount
  IF v_coupon.discount_type = 'percent' THEN
    v_discount := v_pack_price * (v_coupon.discount_value / 100);
    IF v_coupon.max_discount IS NOT NULL AND v_discount > v_coupon.max_discount THEN
      v_discount := v_coupon.max_discount;
    END IF;
  ELSE
    v_discount := LEAST(v_coupon.discount_value, v_pack_price);
  END IF;

  -- Return result
  RETURN QUERY SELECT
    v_coupon.id,
    v_coupon.discount_type,
    v_coupon.discount_value,
    v_coupon.max_discount,
    GREATEST(v_pack_price - v_discount, 0),
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment pack purchase count
CREATE OR REPLACE FUNCTION increment_pack_purchase_count(p_pack_id UUID)
RETURNS VOID AS $$
  UPDATE sound_packs SET purchase_count = purchase_count + 1 WHERE id = p_pack_id;
$$ LANGUAGE sql SECURITY DEFINER;
