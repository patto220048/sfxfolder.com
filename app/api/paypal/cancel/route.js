import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getServerUser, createServerSupabaseClient } from "@/app/lib/supabase-server";

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_key';

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

async function getPayPalAccessToken(clientId, clientSecret, isSandbox) {
  const url = isSandbox
    ? "https://api-m.sandbox.paypal.com/v1/oauth2/token"
    : "https://api-m.paypal.com/v1/oauth2/token";

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || "Failed to get PayPal token");
  return data.access_token;
}

export async function POST(req) {
  try {
    const { subscriptionID } = await req.json();

    if (!subscriptionID) {
      return NextResponse.json({ error: "Missing subscription ID" }, { status: 400 });
    }

    // 1. Authenticate user
    const { user } = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify this subscription belongs to this user (security check)
    const supabase = await createServerSupabaseClient();
    const { data: sub, error: subErr } = await supabase
      .from("subscriptions")
      .select("paypal_subscription_id, status")
      .eq("user_id", user.id)
      .eq("paypal_subscription_id", subscriptionID)
      .single();

    if (subErr || !sub) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    if (sub.status === "CANCELLED") {
      return NextResponse.json({ error: "Already cancelled" }, { status: 400 });
    }

    // 3. Fetch PayPal config
    const { data: settings } = await supabase
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", "paypal_config")
      .single();

    const isSandbox = settings?.setting_value?.env !== "live";
    const activeParams = isSandbox
      ? settings?.setting_value?.sandbox
      : settings?.setting_value?.live;

    const clientId = activeParams?.client_id || process.env.PAYPAL_CLIENT_ID;
    const clientSecret = isSandbox
      ? process.env.PAYPAL_SECRET_SANDBOX
      : process.env.PAYPAL_SECRET_LIVE;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: "Missing PayPal credentials" }, { status: 500 });
    }

    // 4. Get PayPal access token
    const accessToken = await getPayPalAccessToken(clientId, clientSecret, isSandbox);
    const apiBase = isSandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

    // 5. Cancel on PayPal
    const cancelRes = await fetch(
      `${apiBase}/v1/billing/subscriptions/${subscriptionID}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "Cancelled by user request" }),
      }
    );

    // PayPal returns 204 No Content on success
    if (!cancelRes.ok && cancelRes.status !== 204) {
      const err = await cancelRes.json().catch(() => ({}));
      throw new Error(err.message || `PayPal returned ${cancelRes.status}`);
    }

    // 6. Update DB via admin client
    const adminSupabase = getAdminSupabase();

    await adminSupabase
      .from("subscriptions")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("paypal_subscription_id", subscriptionID);

    // CRITICAL: Only set profile status to 'cancelled' if the cancelled sub is the one currently in profile.
    // This prevents an upgrade flow (verify new -> cancel old) from accidentally deactivating the new sub.
    const { data: currentProfile } = await adminSupabase
      .from("profiles")
      .select("subscription_id")
      .eq("id", user.id)
      .single();

    if (currentProfile?.subscription_id === subscriptionID) {
      await adminSupabase
        .from("profiles")
        .update({ subscription_status: "cancelled" })
        .eq("id", user.id);
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("[PayPal Cancel] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
