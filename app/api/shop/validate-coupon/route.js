import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/app/lib/supabase-server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export async function POST(request) {
  try {
    // 1. Auth required
    const supabase = await createServerSupabaseClient();
    let { data: { user } } = await supabase.auth.getUser();

    // Fallback: Authorization header
    if (!user) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const { data: { user: headerUser }, error: headerError } = await supabase.auth.getUser(token);
        if (!headerError && headerUser) {
          user = headerUser;
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code, packId } = await request.json();

    if (!code || !packId) {
      return NextResponse.json(
        { error: "code and packId are required" },
        { status: 400 }
      );
    }

    // 2. Call validate_coupon RPC
    const { data: couponResult, error: couponError } = await supabaseAdmin
      .rpc("validate_coupon", {
        p_code: code,
        p_pack_id: packId,
        p_user_id: user.id,
      });

    if (couponError) {
      console.error("[ShopAPI] Coupon validation RPC error:", couponError);
      return NextResponse.json(
        { error: "Failed to validate coupon" },
        { status: 500 }
      );
    }

    const couponData = Array.isArray(couponResult) ? couponResult[0] : couponResult;

    // 3. Check for error from RPC
    if (!couponData || couponData.error_message) {
      return NextResponse.json({
        valid: false,
        error: couponData?.error_message || "Invalid coupon code",
      });
    }

    // 4. Return coupon details
    return NextResponse.json({
      valid: true,
      couponId: couponData.coupon_id,
      discountType: couponData.discount_type,
      discountValue: couponData.discount_value,
      finalPrice: couponData.final_price,
    });
  } catch (error) {
    console.error("[ShopAPI] Unhandled error in POST /api/shop/validate-coupon:", error);
    return NextResponse.json(
      { error: "Failed to validate coupon" },
      { status: 500 }
    );
  }
}
