import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { getServerUser } from "@/app/lib/supabase-server";
import PackDetailClient from "./PackDetailClient";

export async function generateMetadata({ params: paramsPromise }) {
  const params = await paramsPromise;
  const { slug } = params;

  const { data: pack } = await supabaseAdmin
    .from("sound_packs")
    .select("name, short_description, cover_image")
    .eq("slug", slug)
    .single();

  if (!pack) {
    return {
      title: "Pack Not Found | SFXFolder",
    };
  }

  return {
    title: `${pack.name} — Sound Pack | SFXFolder`,
    description: pack.short_description || `Download ${pack.name} sound pack.`,
    openGraph: {
      title: `${pack.name} — Sound Pack | SFXFolder`,
      description: pack.short_description,
      images: pack.cover_image ? [{ url: pack.cover_image }] : [],
    },
  };
}

export default async function PackDetailPage({ params: paramsPromise }) {
  const params = await paramsPromise;
  const { slug } = params;

  // 1. Fetch pack details
  const { data: pack, error: packErr } = await supabaseAdmin
    .from("sound_packs")
    .select("*")
    .eq("slug", slug)
    .single();

  if (packErr || !pack) {
    notFound();
  }

  // 2. Fetch pack items
  const { data: items } = await supabaseAdmin
    .from("sound_pack_items")
    .select("*")
    .eq("pack_id", pack.id)
    .order("sort_order", { ascending: true });

  // 3. Get server user and check purchase status
  const { user } = await getServerUser();
  let hasPurchased = false;

  if (user) {
    const { data: purchase } = await supabaseAdmin
      .from("pack_purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("pack_id", pack.id)
      .eq("status", "completed")
      .maybeSingle();

    hasPurchased = !!purchase;
  }

  // 4. Load PayPal configuration
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

  // 5. Build JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": pack.name,
    "image": pack.cover_image || "",
    "description": pack.short_description || pack.description || "",
    "sku": pack.id,
    "offers": {
      "@type": "Offer",
      "price": pack.price,
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock",
      "url": `${process.env.NEXT_PUBLIC_SITE_URL || "https://sfxfolder.com"}/shop/${pack.slug}`,
    },
  };

  if (pack.review_count > 0) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": pack.average_rating || 0.0,
      "reviewCount": pack.review_count || 0,
      "bestRating": "5",
      "worstRating": "1"
    };
  }

  return (
    <>
      {/* Schema.org Product Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      <PackDetailClient
        pack={pack}
        initialItems={items || []}
        initialHasPurchased={hasPurchased}
        paypalClientId={paypalClientId}
        paypalMode={paypalMode}
      />
    </>
  );
}
