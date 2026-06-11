import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/app/lib/supabase-server";
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

    const { orderID, packId, couponId } = await request.json();

    if (!orderID || !packId) {
      return NextResponse.json(
        { error: "orderID and packId are required" },
        { status: 400 }
      );
    }

    // 2. Get PayPal config & capture the order
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

    const captureResponse = await fetch(
      `${apiBase}/v2/checkout/orders/${orderID}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const captureData = await captureResponse.json();

    if (!captureResponse.ok) {
      console.error("[ShopAPI] PayPal capture error:", captureData);
      throw new Error(captureData.message || "Failed to capture PayPal payment");
    }

    // 3. Verify capture completed
    if (captureData.status !== "COMPLETED") {
      return NextResponse.json(
        { error: `Payment not completed. Status: ${captureData.status}` },
        { status: 400 }
      );
    }

    // Extract payment amount from capture
    const captureUnit = captureData.purchase_units?.[0]?.payments?.captures?.[0];
    const amountPaid = captureUnit?.amount?.value
      ? parseFloat(captureUnit.amount.value)
      : 0;
    const currency = captureUnit?.amount?.currency_code || "USD";

    // 4. Get pack price to calculate discount
    const { data: pack } = await supabaseAdmin
      .from("sound_packs")
      .select("price")
      .eq("id", packId)
      .single();

    const discountAmount = pack ? pack.price - amountPaid : 0;

    // 5. Insert purchase record
    const { error: insertError } = await supabaseAdmin
      .from("pack_purchases")
      .insert({
        user_id: user.id,
        pack_id: packId,
        paypal_order_id: orderID,
        amount_paid: amountPaid,
        currency,
        coupon_id: couponId || null,
        discount_amount: discountAmount > 0 ? discountAmount : 0,
        status: "completed",
      });

    if (insertError) {
      console.error("[ShopAPI] Purchase insert error:", insertError);
      return NextResponse.json(
        { error: "Payment captured but failed to save purchase record. Please contact support." },
        { status: 500 }
      );
    }

    // 6. Increment pack purchase count
    try {
      await supabaseAdmin.rpc("increment_pack_purchase_count", { p_pack_id: packId });
    } catch (e) {
      console.warn("[ShopAPI] Failed to increment purchase count:", e);
    }

    // 7. Increment coupon used count if applicable
    if (couponId) {
      try {
        const { data: coupon } = await supabaseAdmin
          .from("coupons")
          .select("used_count")
          .eq("id", couponId)
          .single();

        if (coupon) {
          await supabaseAdmin
            .from("coupons")
            .update({ used_count: (coupon.used_count || 0) + 1 })
            .eq("id", couponId);
        }
      } catch (e) {
        console.warn("[ShopAPI] Failed to increment coupon usage:", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ShopAPI] Unhandled error in POST /api/shop/capture-order:", error);
    return NextResponse.json(
      { error: error.message || "Failed to capture payment" },
      { status: 500 }
    );
  }
}
