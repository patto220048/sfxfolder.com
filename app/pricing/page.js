import { getPaypalConfig } from "@/app/lib/api";
import PricingClient from "./PricingClient";
import { Suspense } from "react";

export const revalidate = 86400; // Hardcoded to 24 hours to satisfy Next.js static analysis

export const metadata = {
  title: "Premium Plans — Unlimited Downloads & Exclusive Assets",
  description: "Unlock unlimited access to all premium sound effects, music, presets, and video editing assets. Affordable monthly and yearly plans for content creators.",
};

export default async function PricingPage() {
  const config = await getPaypalConfig();
  
  // Dữ liệu mặc định nếu người dùng chưa chạy SQL hoặc chưa setup.
  const defaultConfig = {
    env: "sandbox",
    sandbox: {
      client_id: "test",
      monthly_plan_id: "",
      monthly_price: 2,
      yearly_plan_id: "",
      yearly_price: 18,
    },
    live: {
      client_id: "live",
      monthly_plan_id: "",
      monthly_price: 2,
      yearly_plan_id: "",
      yearly_price: 18,
    }
  };

  let finalConfig = config || defaultConfig;

  // OVERRIDE FOR LOCAL TESTING: If PAYPAL_MODE=sandbox is set in .env, force it.
  if (process.env.PAYPAL_MODE === "sandbox") {
    console.log("[Pricing] Overriding PayPal config to SANDBOX mode via env variable.");
    finalConfig = {
      ...finalConfig,
      env: "sandbox",
      sandbox: {
        ...finalConfig.sandbox,
        client_id: process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || finalConfig.sandbox?.client_id
      }
    };
  }

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sfxfolder.com';

  // BreadcrumbList schema
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Premium Plans",
        item: `${SITE_URL}/pricing`,
      },
    ],
  };

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <PricingClient config={finalConfig} />
    </Suspense>
  );
}
