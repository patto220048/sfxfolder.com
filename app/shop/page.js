import { supabaseAdmin } from "@/app/lib/supabase-admin";
import ShopClient from "./ShopClient";

export const metadata = {
  title: "Sound Packs — Premium Audio Bundles | SFXFolder",
  description: "Browse and download curated sound effect packs, transitions, and audio assets.",
};

export default async function ShopPage() {
  // 1. Fetch published packs from database
  const { data: packs, error } = await supabaseAdmin
    .from("sound_packs")
    .select("id, name, slug, description, short_description, price, original_price, cover_image, is_featured, item_count, total_size, purchase_count, created_at")
    .eq("status", "published")
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Shop] Failed to fetch packs:", error);
  }

  // 2. Fetch PayPal configuration from system_settings
  const { data: settings } = await supabaseAdmin
    .from("system_settings")
    .select("setting_value")
    .eq("setting_key", "paypal_config")
    .single();

  let paypalClientId = process.env.PAYPAL_CLIENT_ID || "";
  let paypalMode = process.env.PAYPAL_MODE || "sandbox";

  if (settings?.setting_value) {
    const config = settings.setting_value;
    const isSandbox = config.env === "sandbox";
    paypalMode = config.env;
    const activeParams = isSandbox ? config.sandbox : config.live;
    paypalClientId = activeParams?.client_id || paypalClientId;
  }

  return (
    <ShopClient
      initialPacks={packs || []}
      paypalClientId={paypalClientId}
      paypalMode={paypalMode}
    />
  );
}
