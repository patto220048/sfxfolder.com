import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import CheckoutClient from "./CheckoutClient";

export const metadata = {
  title: "Checkout — Sound Pack | SFXFolder",
  description: "Complete your sound pack purchase securely.",
};

export default async function CheckoutPage({ searchParams: searchParamsPromise }) {
  const searchParams = await searchParamsPromise;
  const { packId } = searchParams;

  if (!packId) {
    notFound();
  }

  // 1. Fetch pack details
  const { data: pack, error: packErr } = await supabaseAdmin
    .from("sound_packs")
    .select("*")
    .eq("id", packId)
    .single();

  if (packErr || !pack) {
    notFound();
  }

  // 2. Fetch PayPal configuration
  const { data: settings } = await supabaseAdmin
    .from("system_settings")
    .select("setting_value")
    .eq("setting_key", "paypal_config")
    .single();

  let paypalClientId = "";
  if (process.env.PAYPAL_MODE === "sandbox") {
    paypalClientId = process.env.PAYPAL_CLIENT_ID || "";
  } else if (!settings?.setting_value) {
    paypalClientId = process.env.PAYPAL_CLIENT_ID || "";
  } else {
    const config = settings.setting_value;
    const isSandbox = config.env === "sandbox";
    const activeParams = isSandbox ? config.sandbox : config.live;
    paypalClientId = activeParams?.client_id || process.env.PAYPAL_CLIENT_ID || "";
  }

  return (
    <CheckoutClient
      pack={pack}
      paypalClientId={paypalClientId}
    />
  );
}
