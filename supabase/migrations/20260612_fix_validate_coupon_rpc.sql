-- =========================================================
-- Fix ambiguous column reference in validate_coupon RPC function
-- =========================================================

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
  SELECT COUNT(*) INTO v_user_usage FROM pack_purchases pp
  WHERE pp.user_id = p_user_id AND pp.coupon_id = v_coupon.id;

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
