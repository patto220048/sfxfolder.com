import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServerSupabaseClient, getServerUser } from "@/app/lib/supabase-server";

// Helper: Admin Supabase client that bypasses RLS
function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_key';

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

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

export async function POST(req) {
  try {
    const { subscriptionID, paypalEnv } = await req.json();

    if (!subscriptionID) {
      return NextResponse.json({ error: "Missing subscription ID" }, { status: 400 });
    }

    // 1. Get current authenticated user
    const { user } = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Read PayPal config from DB (or fall back to env)
    const supabase = await createServerSupabaseClient();
    const { data: settings, error: settingsError } = await supabase
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", "paypal_config")
      .single();

    let isSandbox;
    let clientId;

    if (settingsError || !settings) {
      // Fallback: use env variables if DB table not yet set up
      console.warn("[PayPal Verify] system_settings table missing, falling back to env vars.");
      isSandbox = process.env.PAYPAL_MODE !== "live";
      clientId = null; // will be derived from secret logic only
    } else {
      const config = settings.setting_value;
      isSandbox = config.env === "sandbox";

      // Safety check: env from client must match server config
      if (paypalEnv && paypalEnv !== config.env) {
        return NextResponse.json({ error: "Environment mismatch" }, { status: 400 });
      }

      const activeParams = isSandbox ? config.sandbox : config.live;
      clientId = activeParams?.client_id;
    }

    const clientSecret = isSandbox
      ? process.env.PAYPAL_SECRET_SANDBOX
      : process.env.PAYPAL_SECRET_LIVE;

    if (!clientSecret) {
      return NextResponse.json({ error: "Server is missing PayPal Secret Key" }, { status: 500 });
    }

    // If clientId was not set from DB, derive it from the secret (fallback: some SDKs allow secret-only)
    // Usually we still need clientId — let's use the commented-out env var as fallback
    if (!clientId) {
      clientId = process.env.PAYPAL_CLIENT_ID;
    }

    if (!clientId) {
      return NextResponse.json({ error: "Server is missing PayPal Client ID" }, { status: 500 });
    }

    // 3. Get OAuth access token from PayPal
    const accessToken = await getPayPalAccessToken(clientId, clientSecret, isSandbox);

    // 4. Verify subscription with PayPal API
    const apiBase = isSandbox
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com";

    const subResponse = await fetch(
      `${apiBase}/v1/billing/subscriptions/${subscriptionID}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const subData = await subResponse.json();

    if (!subResponse.ok) {
      throw new Error(subData.message || "Failed to fetch subscription from PayPal");
    }

    if (subData.status !== "ACTIVE") {
      return NextResponse.json(
        { error: `Subscription is not active (Status: ${subData.status})` },
        { status: 400 }
      );
    }

    // 5. Store in `subscriptions` table using admin client (bypasses RLS)
    const adminSupabase = getAdminSupabase();

    const { error: dbError } = await adminSupabase.from("subscriptions").upsert(
      {
        user_id: user.id,
        paypal_subscription_id: subscriptionID,
        plan_id: subData.plan_id,
        status: subData.status,
        current_period_start:
          subData.billing_info?.last_payment?.time || new Date().toISOString(),
        current_period_end: subData.billing_info?.next_billing_time || null,
      },
      { onConflict: "paypal_subscription_id" }
    );

    if (dbError) {
      console.error("[PayPal Verify] subscriptions insert error:", dbError);
      return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
    }

    // 6. Sync Premium status to `profiles` table
    const { error: profileError } = await adminSupabase
      .from("profiles")
      .update({
        subscription_status: "active",
        subscription_id: subscriptionID,
        subscription_plan: subData.plan_id,
        subscription_expires_at: subData.billing_info?.next_billing_time || null,
      })
      .eq("id", user.id);

    if (profileError) {
      // Non-fatal: log but don't fail the request
      console.error("[PayPal Verify] profiles update error:", profileError);
    }

    return NextResponse.json({ success: true, status: subData.status });

  } catch (err) {
    console.error("[PayPal Verify] Unhandled error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
