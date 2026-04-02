"use client";

import { useState } from "react";
import { Download, Check } from "lucide-react";
import styles from "./DownloadButton.module.css";

export default function DownloadButton({ fileUrl, fileName, resourceId, onDownload }) {
  const [state, setState] = useState("idle"); // idle | downloading | done

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (state !== "idle") return;
    setState("downloading");

    try {
      // Trigger download
      const link = document.createElement("a");
      link.href = fileUrl || "#";
      link.download = fileName || "download";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Increment download count in background
      if (resourceId) {
        fetch("/api/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resourceId }),
        }).catch(() => {}); // fire and forget
      }

      if (onDownload) onDownload();

      setState("done");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("idle");
    }
  };

  return (
    <button
      className={`${styles.btn} ${styles[state]}`}
      onClick={handleClick}
      disabled={state === "downloading"}
      aria-label={`Download ${fileName || "file"}`}
    >
      {state === "done" ? (
        <Check size={16} className={styles.checkIcon} />
      ) : (
        <Download size={16} className={styles.downloadIcon} />
      )}
      <span className={styles.text}>
        {state === "idle" && "Download"}
        {state === "downloading" && "..."}
        {state === "done" && "Done!"}
      </span>
    </button>
  );
}
