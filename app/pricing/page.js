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

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PricingClient config={config || defaultConfig} />
    </Suspense>
  );
}
