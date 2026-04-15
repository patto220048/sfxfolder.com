"use client";

import { useState } from "react";
import { Download, Check, Loader2 } from "lucide-react";
import { incrementDownloadCount } from "@/app/lib/api";
import styles from "./DownloadButton.module.css";

export default function DownloadButton({ downloadUrl, fileUrl, fileName, fileFormat, resourceId, size }) {
  const [state, setState] = useState("idle"); // idle | downloading | done

  // Resolve URL: prefer downloadUrl, fallback to fileUrl
  const resolvedUrl = downloadUrl || fileUrl;

  // Build proper filename with extension
  const getDownloadName = () => {
    const baseName = fileName?.replace(/\.[^/.]+$/, "") || "download";
    const ext = fileFormat ? `.${fileFormat.replace(/^\./, "").toLowerCase()}` : "";
    return `${baseName}${ext}`;
  };

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (state !== "idle" || !resolvedUrl) return;
    setState("downloading");

    try {
      // 1. Try cross-origin download via blob (allows naming)
      const response = await fetch(resolvedUrl);
      if (!response.ok) throw new Error("Fetch failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = getDownloadName();
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      if (resourceId) {
        incrementDownloadCount(resourceId).catch(() => {});
      }
      setState("done");
      setTimeout(() => setState("idle"), 2000);
    } catch (err) {
      console.warn("Blob download failed (likely CORS). Falling back to direct link.", err);
      
      // 2. Fallback: Open in new tab (browser handles it, usually triggers download or play)
      try {
        const link = document.createElement("a");
        link.href = resolvedUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        // Note: 'download' attribute only works for same-origin or with specific headers
        link.download = getDownloadName(); 
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        if (resourceId) {
          incrementDownloadCount(resourceId).catch(() => {});
        }
        setState("done");
        setTimeout(() => setState("idle"), 2000);
      } catch (fallbackErr) {
        console.error("Direct download fallback failed:", fallbackErr);
        setState("idle");
      }
    }
  };

  return (
    <button
      className={`${styles.btn} ${styles[state]} ${size === "compact" ? styles.compact : ""}`}
      onClick={handleClick}
      disabled={state === "downloading" || !resolvedUrl}
      aria-label={`Download ${fileName || "file"}`}
    >
      {state === "done" ? (
        <Check size={16} className={styles.checkIcon} />
      ) : state === "downloading" ? (
        <Loader2 size={16} className={styles.loaderIcon} />
      ) : (
        <Download size={16} className={styles.downloadIcon} />
      )}
      {size !== "compact" && (
        <span className={styles.text}>
          {state === "idle" && "Download"}
          {state === "downloading" && "..."}
          {state === "done" && "Done!"}
        </span>
      )}
    </button>
  );
}
