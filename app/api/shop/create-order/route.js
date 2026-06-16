import { NextResponse } from "next/server";
import { createServerSupabaseClient, getServerUser } from "@/app/lib/supabase-server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { Resend } from "resend";

// Helper: Get PayPal OAuth access token with Memory Cache
async function getPayPalAccessToken(clientId, clientSecret, isSandbox) {
  const cacheKey = `${clientId}:${isSandbox}`;
  if (global.paypalTokenCache?.[cacheKey] && Date.now() < global.paypalTokenCache[cacheKey].expiry) {
    return global.paypalTokenCache[cacheKey].token;
  }

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

  if (!global.paypalTokenCache) {
    global.paypalTokenCache = {};
  }
  
  const expiresInMs = (data.expires_in || 3600) * 1000;
  global.paypalTokenCache[cacheKey] = {
    token: data.access_token,
    expiry: Date.now() + expiresInMs - 60000,
  };

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

    // 2. Fetch pack details, check existing purchase, and load PayPal config in parallel
    const [packRes, purchaseRes, paypalConfigRes, couponRes] = await Promise.all([
      supabaseAdmin
        .from("sound_packs")
        .select("id, name, price, status")
        .eq("id", packId)
        .single(),
      supabaseAdmin
        .from("pack_purchases")
        .select("id")
        .eq("user_id", user.id)
        .eq("pack_id", packId)
        .eq("status", "completed")
        .maybeSingle(),
      supabaseAdmin
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "paypal_config")
        .single(),
      couponCode
        ? supabaseAdmin.rpc("validate_coupon", {
            p_code: couponCode,
            p_pack_id: packId,
            p_user_id: user.id,
          })
        : Promise.resolve({ data: null, error: null }),
    ]);

    const { data: pack, error: packError } = packRes;
    const { data: existingPurchase } = purchaseRes;
    const { data: settings } = paypalConfigRes;
    const { data: couponResult, error: couponError } = couponRes;

    if (packError || !pack) {
      console.error("[CreateOrderAPI] Pack not found or query error:", packError, pack);
      return NextResponse.json({ error: "Pack not found" }, { status: 404 });
    }

    if (pack.status !== "published") {
      return NextResponse.json({ error: "Pack is not available" }, { status: 400 });
    }

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

      // Send thank you email to user via Resend (Free Coupon purchase)
      try {
        if (process.env.RESEND_API_KEY && user.email) {
          const resend = new Resend(process.env.RESEND_API_KEY);
          let resendFrom = process.env.RESEND_FROM || "onboarding@resend.dev";
          if (resendFrom && !resendFrom.includes("@")) {
            resendFrom = `no-reply@${resendFrom}`;
          }
          const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sfxfolder.com";
          const libraryUrl = `${SITE_URL}/account/purchases`;

          const emailResponse = await resend.emails.send({
            from: `SFXFolder <${resendFrom}>`,
            to: [user.email],
            subject: `Your sound pack: ${pack ? pack.name : "Sound Pack"}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0c10; color: #e5e5e5; padding: 40px 20px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #1f2833;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <h1 style="color: #66fcf1; font-size: 28px; margin: 0; letter-spacing: 1px; font-weight: bold;">SFXFOLDER</h1>
                  <p style="color: #c5c6c7; font-size: 14px; margin-top: 5px;">Premium Audio & Sound Effects</p>
                </div>
                
                <div style="background-color: #1f2833; padding: 30px; border-radius: 6px; border-left: 4px solid #66fcf1;">
                  <h2 style="color: #ffffff; font-size: 20px; margin-top: 0;">Thank you!</h2>
                  <p style="font-size: 16px; line-height: 1.6; color: #c5c6c7;">
                    Hi there, you have successfully unlocked lifetime download access to <strong>${pack ? pack.name : "your sound pack"}</strong> using a discount coupon.
                  </p>
                  
                  <div style="margin: 25px 0; padding: 20px; background-color: #0b0c10; border-radius: 4px; border: 1px solid #45f3ff33;">
                    <h3 style="margin-top: 0; color: #ffffff; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Order Summary</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #c5c6c7;">
                      <tr>
                        <td style="padding: 6px 0; color: #ffffff;">Sound Pack:</td>
                        <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #ffffff;">${pack ? pack.name : "Sound Pack"}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">Promo Code:</td>
                        <td style="padding: 6px 0; text-align: right; font-family: monospace; color: #66fcf1;">Applied</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0;">Amount Paid:</td>
                        <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #66fcf1;">$0.00 USD (FREE)</td>
                      </tr>
                    </table>
                  </div>

                  <p style="font-size: 16px; line-height: 1.6; color: #c5c6c7; margin-bottom: 25px;">
                    You can download your audio assets and view your purchased items anytime from your personal Library page.
                  </p>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${libraryUrl}" style="background-color: #66fcf1; color: #0b0c10; text-decoration: none; padding: 14px 30px; font-weight: bold; border-radius: 4px; font-size: 16px; display: inline-block; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(102, 252, 241, 0.2);">
                      Go to My Library
                    </a>
                  </div>
                </div>
                
                <div style="text-align: center; margin-top: 35px; color: #888888; font-size: 12px;">
                  <p style="margin: 0;">This is an automated receipt for your purchase at SFXFolder.com.</p>
                  <p style="margin: 5px 0 0 0;">Need help? Reply to this email or contact our support team.</p>
                </div>
              </div>
            `,
          });

          if (emailResponse.error) {
            console.error("[Email] Resend API error:", emailResponse.error);
          } else {
            console.log(`[Email] Coupon thank you email sent successfully to ${user.email} for pack: ${pack ? pack.name : packId}`);
          }
        }
      } catch (emailError) {
        console.error("[Email] Failed to send free pack thank you email:", emailError);
      }

      return NextResponse.json({ success: true, free: true });
    }

    // 6. Parse PayPal config from parallelized results
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
