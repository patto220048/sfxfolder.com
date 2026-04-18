import { createServerSupabaseClient, getServerUser } from "@/app/lib/supabase-server";
import SubscriptionClient from "./SubscriptionClient";
import { redirect } from "next/navigation";

export const metadata = {
  title: "My Subscription",
  description: "Manage your Premium subscription",
};

export default async function SubscriptionPage() {
  const { user } = await getServerUser();
  if (!user) redirect("/");

  const supabase = await createServerSupabaseClient();

  // Fetch the user's active (or most recent) subscription
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Fetch the plan label from system_settings
  const { data: settings } = await supabase
    .from("system_settings")
    .select("setting_value")
    .eq("setting_key", "paypal_config")
    .single();

  const config = settings?.setting_value;
  const activeParams = config?.env === "live" ? config?.live : config?.sandbox;

  // Map plan_id to a human-readable label
  let planLabel = "Premium";
  if (subscription?.plan_id) {
    if (subscription.plan_id === activeParams?.monthly_plan_id) {
      planLabel = `Monthly — $${activeParams?.monthly_price}/mo`;
    } else if (subscription.plan_id === activeParams?.yearly_plan_id) {
      planLabel = `Yearly — $${activeParams?.yearly_price}/yr`;
    }
  }

  return (
    <SubscriptionClient
      subscription={subscription || null}
      planLabel={planLabel}
      userEmail={user.email}
    />
  );
}
