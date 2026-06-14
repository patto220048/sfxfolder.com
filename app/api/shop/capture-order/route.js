import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/app/lib/supabase-server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { Resend } from "resend";

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

    // 4. Get pack details to calculate discount & display in email
    const { data: pack } = await supabaseAdmin
      .from("sound_packs")
      .select("name, price")
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

    // 8. Send thank you email to user via Resend
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
          subject: `Thank you for your purchase: ${pack ? pack.name : "Sound Pack"}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0c10; color: #e5e5e5; padding: 40px 20px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #1f2833;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #66fcf1; font-size: 28px; margin: 0; letter-spacing: 1px; font-weight: bold;">SFXFOLDER</h1>
                <p style="color: #c5c6c7; font-size: 14px; margin-top: 5px;">Premium Audio & Sound Effects</p>
              </div>
              
              <div style="background-color: #1f2833; padding: 30px; border-radius: 6px; border-left: 4px solid #66fcf1;">
                <h2 style="color: #ffffff; font-size: 20px; margin-top: 0;">Thank you!</h2>
                <p style="font-size: 16px; line-height: 1.6; color: #c5c6c7;">
                  Hi there, thank you for your purchase! You have successfully unlocked lifetime download access to <strong>${pack ? pack.name : "your purchased sound pack"}</strong>.
                </p>
                
                <div style="margin: 25px 0; padding: 20px; background-color: #0b0c10; border-radius: 4px; border: 1px solid #45f3ff33;">
                  <h3 style="margin-top: 0; color: #ffffff; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Order Summary</h3>
                  <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #c5c6c7;">
                    <tr>
                      <td style="padding: 6px 0; color: #ffffff;">Sound Pack:</td>
                      <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #ffffff;">${pack ? pack.name : "Sound Pack"}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0;">Order ID:</td>
                      <td style="padding: 6px 0; text-align: right; font-family: monospace;">${orderID}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0;">Amount Paid:</td>
                      <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #66fcf1;">$${amountPaid.toFixed(2)} USD</td>
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
          console.log(`[Email] Thank you email sent successfully to ${user.email} for pack: ${pack ? pack.name : packId}`);
        }
      }
    } catch (emailError) {
      console.error("[Email] Failed to send thank you email:", emailError);
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
