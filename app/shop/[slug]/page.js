import { notFound } from "next/navigation";
import { cache } from "react";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import PackDetailClient from "./PackDetailClient";

export const revalidate = 3600; // Cache and revalidate in background every 1 hour

// Cached data fetching to prevent duplicate queries between generateMetadata and page render
const getPack = cache(async (slug) => {
  const { data } = await supabaseAdmin
    .from("sound_packs")
    .select("*")
    .eq("slug", slug)
    .single();
  return data;
});

const getPackItems = cache(async (packId) => {
  const { data } = await supabaseAdmin
    .from("sound_pack_items")
    .select("*")
    .eq("pack_id", packId)
    .order("sort_order", { ascending: true });
  return data;
});

const getPaypalConfig = cache(async () => {
  const { data } = await supabaseAdmin
    .from("system_settings")
    .select("setting_value")
    .eq("setting_key", "paypal_config")
    .single();
  return data;
});

export async function generateStaticParams() {
  const { data: packs } = await supabaseAdmin
    .from("sound_packs")
    .select("slug")
    .eq("status", "published");

  if (!packs) return [];
  return packs.map((pack) => ({
    slug: pack.slug,
  }));
}

export async function generateMetadata({ params: paramsPromise }) {
  const params = await paramsPromise;
  const { slug } = params;

  const pack = await getPack(slug);

  if (!pack) {
    return {
      title: "Pack Not Found | SFXFolder",
    };
  }

  const title = `${pack.name} — Sound Pack | SFXFolder`;
  const description = pack.short_description || `Download ${pack.name} sound pack.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: pack.cover_image ? [{ url: pack.cover_image }] : [],
    },
  };
}

export default async function PackDetailPage({ params: paramsPromise }) {
  const params = await paramsPromise;
  const { slug } = params;

  // 1. Fetch pack details
  const pack = await getPack(slug);

  if (!pack) {
    notFound();
  }

  // 2. Parallel fetch pack items and PayPal configuration
  const [items, settings] = await Promise.all([
    getPackItems(pack.id),
    getPaypalConfig(),
  ]);

  let paypalClientId = "";
  let paypalMode = "sandbox";

  if (process.env.PAYPAL_MODE === "sandbox") {
    paypalMode = "sandbox";
    paypalClientId = process.env.PAYPAL_CLIENT_ID || "";
  } else if (!settings?.setting_value) {
    paypalMode = process.env.PAYPAL_MODE || "sandbox";
    paypalClientId = process.env.PAYPAL_CLIENT_ID || "";
  } else {
    const config = settings.setting_value;
    const isSandbox = config.env === "sandbox";
    paypalMode = config.env;
    const activeParams = isSandbox ? config.sandbox : config.live;
    paypalClientId = activeParams?.client_id || process.env.PAYPAL_CLIENT_ID || "";
  }

  // 3. Build JSON-LD structured data (Product Schema & BreadcrumbList)
  const productJsonLd = {
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
    productJsonLd.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": pack.average_rating || 0.0,
      "reviewCount": pack.review_count || 0,
      "bestRating": "5",
      "worstRating": "1"
    };
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": process.env.NEXT_PUBLIC_SITE_URL || "https://sfxfolder.com",
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Shop",
        "item": `${process.env.NEXT_PUBLIC_SITE_URL || "https://sfxfolder.com"}/shop`,
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": pack.name,
        "item": `${process.env.NEXT_PUBLIC_SITE_URL || "https://sfxfolder.com"}/shop/${pack.slug}`,
      },
    ],
  };

  return (
    <>
      {/* Schema.org Product Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      {/* Schema.org BreadcrumbList Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      
      <PackDetailClient
        pack={pack}
        initialItems={items || []}
        initialHasPurchased={false} // Will check client-side
        paypalClientId={paypalClientId}
        paypalMode={paypalMode}
      />
    </>
  );
}
