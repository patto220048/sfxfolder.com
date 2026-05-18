"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import styles from "./CategoryStickyAd.module.css";
import { useSearchParams } from "next/navigation";

export default function CategoryStickyAd() {
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

  // Don't show in plugin
  if (!isVisible || isPlugin) return null;

  return (
    <div className={styles.adContainer}>
      <div className={styles.adContent}>
        <div className={styles.adPlaceholder}>
          Advertisement - Placeholder (728x90 or 320x50)
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
