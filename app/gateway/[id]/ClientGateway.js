"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Download, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/app/lib/auth-context";
import { useSiteData } from "@/app/context/SiteContext";
import AdSlot from "@/app/components/ads/AdSlot";
import styles from "./gateway.module.css";

function formatSize(bytes) {
  if (!bytes) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function ClientGateway({ resource }) {
  const [countdown, setCountdown] = useState(5);
  const [status, setStatus] = useState("waiting"); // waiting | downloading | done | error
  const [errorMessage, setErrorMessage] = useState("");
  const { session } = useAuth();
  const { settings } = useSiteData();
  const ads = settings?.ads_config || {};

  const handleDownload = async () => {
    setStatus("downloading");
    setErrorMessage("");
    try {
      const headers = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch("/api/download", {
        method: "POST",
        headers,
        body: JSON.stringify({ resourceId: resource.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Download failed. Please try again.");
      }

      const { downloadUrl } = await response.json();
      if (!downloadUrl) throw new Error("Could not retrieve download link.");

      // Trigger standard browser download
      window.location.href = downloadUrl;

      setStatus("done");
    } catch (err) {
      console.error("Download failed:", err);
      setErrorMessage(err.message);
      setStatus("error");
    }
  };

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && status === "waiting") {
      // Auto-trigger download when countdown hits 0
      handleDownload();
    }
  }, [countdown, status]);

  const displayName = (resource.name || resource.file_name || "Untitled").replace(/\.[^/.]+$/, "");

  return (
    <>
      <div className={styles.container}>
        <div className={styles.mainWrapper}>
          {/* Left Ad */}
          {ads.gateway_left && ads.gateway_left.trim() !== '' ? (
            <div className={styles.sideAdContainer}>
              <AdSlot htmlContent={ads.gateway_left} />
            </div>
          ) : (
            <div className={styles.sideAdPlaceholder}>
              Advertisement<br />(160x600)
            </div>
          )}

          <div className={styles.content}>
            <h1 className={styles.title}>Preparing your download...</h1>
            <p className={styles.subtitle}>Please wait 5 seconds to download. This helps us prevent bot scraping.</p>

            <div className={styles.countdownCircle}>
              {countdown > 0 ? countdown : (status === "done" ? <Check size={48} /> : "0")}
            </div>

            <div className={styles.fileInfo}>
              <div className={styles.fileName} title={displayName}>{displayName}</div>
              <div className={styles.fileMeta}>
                {resource.file_format?.toUpperCase()} • {formatSize(resource.file_size)}
              </div>
            </div>

            {status === "waiting" && countdown > 0 && (
              <button className={styles.fallbackBtn} disabled>
                <Loader2 size={18} className="animate-spin" /> Please wait...
              </button>
            )}

            {(status === "downloading" || (countdown === 0 && status === "waiting")) && (
              <button className={styles.fallbackBtn} disabled>
                <Loader2 size={18} className="animate-spin" /> Downloading...
              </button>
            )}

            {status === "done" && (
              <button className={styles.fallbackBtn} onClick={handleDownload}>
                <Download size={18} /> Download Again
              </button>
            )}

            {status === "error" && (
              <div style={{ color: "#ef4444", marginBottom: "10px" }}>
                <p>{errorMessage}</p>
                <button className={styles.fallbackBtn} onClick={handleDownload} style={{ marginTop: "10px" }}>
                  <Download size={18} /> Try Again
                </button>
              </div>
            )}

            {/* Premium Upgrade Prompt */}
            <div className={styles.premiumUpgrade}>
              <div className={styles.premiumTitle}>Tired of waiting?</div>
              <div className={styles.premiumText}>Upgrade to Premium for instant downloads, no ads, and access to all plugins.</div>
              <Link href="/pricing" className={styles.premiumBtn}>Upgrade Now</Link>
            </div>
          </div>

          {/* Right Ad */}
          {ads.gateway_right && ads.gateway_right.trim() !== '' ? (
            <div className={styles.sideAdContainer}>
              <AdSlot htmlContent={ads.gateway_right} />
            </div>
          ) : (
            <div className={styles.sideAdPlaceholder}>
              Advertisement<br />(160x600)
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Ad */}
      <div className={styles.bottomAd}>
        {ads.category_sticky && ads.category_sticky.trim() !== '' ? (
          <div className={styles.adWrapper}>
            <AdSlot htmlContent={ads.category_sticky} />
          </div>
        ) : (
          <div className={styles.adPlaceholder}>
            Advertisement - Placeholder (728x90 or 320x50)
          </div>
        )}
      </div>
    </>
  );
}
