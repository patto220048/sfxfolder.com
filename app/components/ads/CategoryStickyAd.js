"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import styles from "./CategoryStickyAd.module.css";
import { useSiteData } from "@/app/context/SiteContext";
import AdSlot from "./AdSlot";

export default function CategoryStickyAd() {
  const { settings } = useSiteData();
  const adHtml = settings?.ads_config?.category_sticky;

  const [countdown, setCountdown] = useState(5);
  const [isVisible, setIsVisible] = useState(true);
  const searchParams = useSearchParams();
  const isPlugin = searchParams?.get("mode") === "plugin" || (typeof window !== 'undefined' && window.location.search.includes('mode=plugin'));

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Don't show in plugin or if no ad script is configured
  if (!isVisible || isPlugin || !adHtml || adHtml.trim() === '') return null;

  return (
    <div className={styles.adContainer}>
      <div className={styles.adContent}>
        <div className={styles.adWrapper}>
          <AdSlot htmlContent={adHtml} />
        </div>
        {countdown === 0 ? (
          <button className={styles.closeBtn} onClick={() => setIsVisible(false)} aria-label="Close Ad">
            <X size={14} />
          </button>
        ) : (
          <div className={styles.countdownBadge}>
            Close in {countdown}s
          </div>
        )}
      </div>
    </div>
  );
}
