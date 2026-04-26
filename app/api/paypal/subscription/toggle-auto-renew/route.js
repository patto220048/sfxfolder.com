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
    const { subscriptionID, autoRenew } = await req.json();

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
      .select("paypal_subscription_id, status, auto_renew")
      .eq("user_id", user.id)
      .eq("paypal_subscription_id", subscriptionID)
      .single();

    if (subErr || !sub) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    if (sub.status === "CANCELLED" || sub.status === "EXPIRED") {
      return NextResponse.json({ error: "Cannot toggle auto-renew for a cancelled or expired subscription" }, { status: 400 });
    }

    // Check if subscription has already expired by date
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_expires_at")
      .eq("id", user.id)
      .single();

    if (profile?.subscription_expires_at && new Date(profile.subscription_expires_at) < new Date()) {
      return NextResponse.json({ error: "Subscription has already expired. Please resubscribe." }, { status: 400 });
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

    // 5. Toggle on PayPal
    // If autoRenew is true, we call 'activate'. If false, we call 'suspend'.
    const action = autoRenew ? "activate" : "suspend";
    const paypalRes = await fetch(
      `${apiBase}/v1/billing/subscriptions/${subscriptionID}/${action}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: autoRenew ? "Re-activated by user" : "Suspended by user (auto-renew off)" }),
      }
    );

    // PayPal returns 204 No Content on success
    if (!paypalRes.ok && paypalRes.status !== 204) {
      const err = await paypalRes.json().catch(() => ({}));
      throw new Error(err.message || `PayPal returned ${paypalRes.status}`);
    }

    // 6. Update DB via admin client
    const adminSupabase = getAdminSupabase();
    const newStatus = autoRenew ? "ACTIVE" : "SUSPENDED";

    await adminSupabase
      .from("subscriptions")
      .update({ 
        status: newStatus, 
        auto_renew: autoRenew,
        updated_at: new Date().toISOString() 
      })
      .eq("paypal_subscription_id", subscriptionID);

    await adminSupabase
      .from("profiles")
      .update({ 
        subscription_status: newStatus.toLowerCase() 
      })
      .eq("id", user.id);

    return NextResponse.json({ success: true, status: newStatus });

  } catch (err) {
    console.error("[PayPal Toggle] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
