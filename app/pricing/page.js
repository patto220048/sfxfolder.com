import { getPaypalConfig, REVALIDATE_TIME } from "@/app/lib/api";
import PricingClient from "./PricingClient";

export const revalidate = REVALIDATE_TIME;

export const metadata = {
  title: "Premium Subscriptions - Stark Monochrome",
  description: "Get unlimited access to all resources",
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

  return <PricingClient config={config || defaultConfig} />;
}
