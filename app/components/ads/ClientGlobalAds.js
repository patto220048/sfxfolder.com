"use client";

import { useAuth } from "@/app/lib/auth-context";
import { useSiteData } from "@/app/context/SiteContext";
import AdSlot from "./AdSlot";

export default function ClientGlobalAds() {
  const { isPremium } = useAuth();
  const { settings } = useSiteData();
  const headScript = settings?.ads_config?.head_script;

  if (isPremium || !headScript || headScript.trim() === '') return null;

  return (
    <div style={{ display: 'none' }}>
      <AdSlot htmlContent={headScript} />
    </div>
  );
}
