"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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

  const hasAd = adHtml && adHtml.trim() !== '';

  // Don't show in plugin
  if (!isVisible || isPlugin) return null;

  return (
    <div className={styles.adContainer}>
      <div className={styles.adContent}>
        <div className={styles.adWrapper}>
          {hasAd ? (
            <AdSlot htmlContent={adHtml} />
          ) : (
            <div style={{ padding: '15px', background: 'var(--bg-card)', border: '1px dashed var(--border-color)', color: 'var(--text-muted)', textAlign: 'center', width: '100%', minHeight: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Advertisement - Placeholder (728x90)
            </div>
          )}
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
