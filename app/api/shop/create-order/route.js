import { NextResponse } from "next/server";
import { createServerSupabaseClient, getServerUser } from "@/app/lib/supabase-server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

// Helper: Get PayPal OAuth access token
async function getPayPalAccessToken(clientId, clientSecret, isSandbox) {
  const url = isSandbox
    ? "https://api-m.sandbox.paypal.com/v1/oauth2/token"
    : "https://api-m.paypal.com/v1/oauth2/token";

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || "Failed to get PayPal access token");
  }
  return data.access_token;
}

// Helper: Load PayPal config from system_settings or env
async function getPayPalConfig() {
  const { data: settings } = await supabaseAdmin
    .from("system_settings")
    .select("setting_value")
    .eq("setting_key", "paypal_config")
    .single();

  let isSandbox;
  let clientId;

  if (process.env.PAYPAL_MODE === "sandbox") {
    isSandbox = true;
    clientId = process.env.PAYPAL_CLIENT_ID;
  } else if (!settings) {
    console.warn("[ShopAPI] system_settings missing, falling back to env vars.");
    isSandbox = process.env.PAYPAL_MODE !== "live";
    clientId = process.env.PAYPAL_CLIENT_ID;
  } else {
    const config = settings.setting_value;
    isSandbox = config.env === "sandbox";
    const activeParams = isSandbox ? config.sandbox : config.live;
    clientId = activeParams?.client_id;
  }

  const clientSecret = isSandbox
    ? process.env.PAYPAL_SECRET_SANDBOX
    : process.env.PAYPAL_SECRET_LIVE;

  if (!clientId) clientId = process.env.PAYPAL_CLIENT_ID;

  return { isSandbox, clientId, clientSecret };
}

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

    const { packId, couponCode } = await request.json();
    console.log("[CreateOrderAPI] Received request for packId:", packId, "couponCode:", couponCode);

    if (!packId) {
      return NextResponse.json({ error: "packId is required" }, { status: 400 });
    }

    const { data: pack, error: packError } = await supabaseAdmin
      .from("sound_packs")
      .select("id, name, price, status")
      .eq("id", packId)
      .single();

    if (packError || !pack) {
      console.error("[CreateOrderAPI] Pack not found or query error:", packError, pack);
      return NextResponse.json({ error: "Pack not found" }, { status: 404 });
    }

    if (pack.status !== "published") {
      return NextResponse.json({ error: "Pack is not available" }, { status: 400 });
    }

    // 3. Check if user already purchased
    const { data: existingPurchase } = await supabaseAdmin
      .from("pack_purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("pack_id", packId)
      .eq("status", "completed")
      .maybeSingle();

    if (existingPurchase) {
      return NextResponse.json(
        { error: "You already own this pack" },
        { status: 409 }
      );
    }

    // 4. Validate coupon if provided
    let finalPrice = pack.price;
    let couponId = null;
    let discountAmount = 0;

    if (couponCode) {
      const { data: couponResult, error: couponError } = await supabaseAdmin
        .rpc("validate_coupon", {
          p_code: couponCode,
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

      if (couponData?.error_message) {
        return NextResponse.json(
          { error: couponData.error_message },
          { status: 400 }
        );
      }

      if (couponData) {
        couponId = couponData.coupon_id;
        finalPrice = couponData.final_price;
        discountAmount = pack.price - finalPrice;
      }
    }

    // 5. If free after coupon: complete purchase directly
    if (finalPrice <= 0) {
      const { error: insertError } = await supabaseAdmin
        .from("pack_purchases")
        .insert({
          user_id: user.id,
          pack_id: packId,
          paypal_order_id: `FREE-${Date.now()}`,
          amount_paid: 0,
          currency: "USD",
          coupon_id: couponId,
          discount_amount: discountAmount,
          status: "completed",
        });

      if (insertError) {
        console.error("[ShopAPI] Free purchase insert error:", insertError);
        return NextResponse.json(
          { error: "Failed to process free purchase" },
          { status: 500 }
        );
      }

      // Increment purchase count
      try {
        await supabaseAdmin.rpc("increment_pack_purchase_count", { p_pack_id: packId });
      } catch (e) {
        console.warn("[ShopAPI] Failed to increment purchase count:", e);
      }

      // Increment coupon used count
      if (couponId) {
        try {
          await supabaseAdmin
            .from("coupons")
            .update({ used_count: supabaseAdmin.rpc ? undefined : 0 })
            .eq("id", couponId);
          // Use raw SQL increment via RPC or manual increment
          await supabaseAdmin.rpc("increment_coupon_used_count", { p_coupon_id: couponId }).catch(() => {
            // Fallback: manual increment
            supabaseAdmin
              .from("coupons")
              .select("used_count")
              .eq("id", couponId)
              .single()
              .then(({ data }) => {
                if (data) {
                  supabaseAdmin
                    .from("coupons")
                    .update({ used_count: (data.used_count || 0) + 1 })
                    .eq("id", couponId);
                }
              });
          });
        } catch (e) {
          console.warn("[ShopAPI] Failed to increment coupon usage:", e);
        }
      }

      return NextResponse.json({ success: true, free: true });
    }

    // 6. Create PayPal order
    const { isSandbox, clientId, clientSecret } = await getPayPalConfig();

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Payment service is not configured" },
        { status: 500 }
      );
    }

    const accessToken = await getPayPalAccessToken(clientId, clientSecret, isSandbox);

    const apiBase = isSandbox
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com";

    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: packId,
          description: pack.name,
          amount: {
            currency_code: "USD",
            value: finalPrice.toFixed(2),
          },
        },
      ],
    };

    const orderResponse = await fetch(`${apiBase}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    const orderData = await orderResponse.json();

    if (!orderResponse.ok) {
      console.error("[ShopAPI] PayPal create order error:", orderData);
      throw new Error(orderData.message || "Failed to create PayPal order");
    }

    return NextResponse.json({
      orderID: orderData.id,
      couponId,
      finalPrice,
    });
  } catch (error) {
    console.error("[ShopAPI] Unhandled error in POST /api/shop/create-order:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create order" },
      { status: 500 }
    );
  }
}
