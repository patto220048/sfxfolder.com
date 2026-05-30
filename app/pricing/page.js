import { getPaypalConfig } from "@/app/lib/api";
import PricingClient from "./PricingClient";
import { Suspense } from "react";

export const revalidate = 86400; // Hardcoded to 24 hours to satisfy Next.js static analysis

export const metadata = {
  title: "Premium Plans — Fast Downloads, Ad-Free & Unlimited Access",
  description: "Unlock unlimited, ad-free access to all premium sound effects, music, presets, and video editing assets with high-speed downloads. Affordable monthly and yearly plans.",
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

  // Product & Offer schema for recurring subscriptions
  // Includes: brand, sku, availability, hasMerchantReturnPolicy, shippingDetails
  // to satisfy Google Search Console recommended fields
  const returnPolicy = {
    "@type": "MerchantReturnPolicy",
    "applicableCountry": "US",
    "returnPolicyCategory": "https://schema.org/MerchantReturnNotPermitted",
    "merchantReturnLink": `${SITE_URL}/terms`
  };

  const shippingDetails = {
    "@type": "OfferShippingDetails",
    "shippingRate": {
      "@type": "MonetaryAmount",
      "value": "0",
      "currency": "USD"
    },
    "shippingDestination": {
      "@type": "DefinedRegion",
      "addressCountry": "US"
    },
    "deliveryTime": {
      "@type": "ShippingDeliveryTime",
      "handlingTime": {
        "@type": "QuantitativeValue",
        "minValue": "0",
        "maxValue": "0",
        "unitCode": "DAY"
      },
      "transitTime": {
        "@type": "QuantitativeValue",
        "minValue": "0",
        "maxValue": "0",
        "unitCode": "DAY"
      }
    }
  };

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "SFXFolder Premium Subscription",
    "image": `${SITE_URL}/og-default.jpg`,
    "description": "Get unlimited access to all premium sound effects, music, presets, and video editing assets with high-speed downloads and ad-free experience.",
    "brand": {
      "@type": "Brand",
      "name": "SFXFolder"
    },
    "sku": "SFXFOLDER-PREMIUM",
    "category": "Software > Digital Subscription",
    "offers": [
      {
        "@type": "Offer",
        "name": "Monthly Plan",
        "price": "2.00",
        "priceCurrency": "USD",
        "availability": "https://schema.org/InStock",
        "priceSpecification": {
          "@type": "UnitPriceSpecification",
          "price": "2.00",
          "priceCurrency": "USD",
          "referenceQuantity": {
            "@type": "QuantitativeValue",
            "value": "1",
            "unitCode": "MON"
          }
        },
        "url": `${SITE_URL}/pricing`,
        "hasMerchantReturnPolicy": returnPolicy,
        "shippingDetails": shippingDetails
      },
      {
        "@type": "Offer",
        "name": "Yearly Plan",
        "price": "18.00",
        "priceCurrency": "USD",
        "availability": "https://schema.org/InStock",
        "priceSpecification": {
          "@type": "UnitPriceSpecification",
          "price": "18.00",
          "priceCurrency": "USD",
          "referenceQuantity": {
            "@type": "QuantitativeValue",
            "value": "1",
            "unitCode": "ANN"
          }
        },
        "url": `${SITE_URL}/pricing`,
        "hasMerchantReturnPolicy": returnPolicy,
        "shippingDetails": shippingDetails
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <Suspense fallback={<div>Loading...</div>}>
        <PricingClient config={finalConfig} />
      </Suspense>
    </>
  );
}
