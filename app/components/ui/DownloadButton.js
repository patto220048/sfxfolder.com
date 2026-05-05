import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Check, Loader2, Plus } from "lucide-react";
import { useAuth } from "@/app/lib/auth-context";
import { usePluginCache } from "@/app/hooks/usePluginCache";
import styles from "./DownloadButton.module.css";

export default function DownloadButton({ downloadUrl, fileUrl, fileName, fileFormat, resourceId, size, isPremiumResource, isPlugin = false }) {
  const [state, setState] = useState("idle"); // idle | downloading | done
  const { user, session, isPremium, isAdmin, loading } = useAuth();
  const router = useRouter();

  // Resolve proper filename with extension
  const getFullFileName = () => {
    const baseName = fileName?.replace(/\.[^/.]+$/, "") || "download";
    const ext = fileFormat ? `.${fileFormat.replace(/^\./, "").toLowerCase()}` : "";
    return `${baseName}${ext}`;
  };

  // Use our new reusable hook
  const { downloadStatus, progress, isInsidePlugin, downloadResource, importAsset } = usePluginCache(resourceId, getFullFileName(), fileFormat);

  const resolvedUrl = downloadUrl || fileUrl;

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // If already cached in plugin, just import immediately
    if (isInsidePlugin && downloadStatus === 'cached') {
      importAsset(); // This sends IMPORT_ASSET via hook
      return;
    }

    if (loading) return;

    // Premium Check
    if (!isAdmin && !isPremium) {
      window.dispatchEvent(new CustomEvent("need-premium"));
      return;
    }

    if (state !== "idle" || (isInsidePlugin && downloadStatus === 'downloading')) return;
    setState("downloading");

    try {
      // 1. Get Secure Signed Download URL
      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/download', {
        method: 'POST',
        headers,
        body: JSON.stringify({ resourceId: resourceId }),
      });

      if (!response.ok) throw new Error("Download failed");

      const { downloadUrl: signedUrl } = await response.json();
      if (!signedUrl) throw new Error("No download URL");

      if (isInsidePlugin) {
        // 2. Delegate to Plugin Shell via Hook
        downloadResource(signedUrl);
        // We stay in 'downloading' until Shell reports 'DOWNLOAD_COMPLETE'
        setTimeout(() => setState("idle"), 1000); 
      } else {
        // 2. Standard Browser Download
        const link = document.createElement('a');
        link.href = signedUrl;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => document.body.removeChild(link), 100);
        
        setState("done");
        setTimeout(() => setState("idle"), 2000);
      }
    } catch (err) {
      console.error("Download failed:", err);
      setState("idle");
    }
  };

  const getIcon = () => {
    if (isInsidePlugin) {
      if (downloadStatus === 'downloading') return <Loader2 size={16} className={`${styles.loaderIcon} animate-spin`} />;
      if (downloadStatus === 'cached') return <Plus size={16} color="white" />;
      return <Download size={16} className={styles.downloadIcon} />;
    }

    if (state === "done") return <Check size={16} className={styles.checkIcon} />;
    if (state === "downloading") return <Loader2 size={16} className={`${styles.loaderIcon} animate-spin`} />;
    return <Download size={16} className={styles.downloadIcon} />;
  };

  const getLabel = () => {
    if (state === "done") return "Done!";
    if (isInsidePlugin) {
      if (downloadStatus === 'downloading') return `${Math.round(progress)}%`;
      if (downloadStatus === 'cached') return "Add";
      return "Download Asset"; 
    }
    if (state === "downloading") return "...";
    return "Download";
  };

  return (
    <button
      className={`${styles.btn} ${styles[state]} ${size === "compact" ? styles.compact : ""} ${isInsidePlugin && downloadStatus === 'cached' ? styles.cached : ""}`}
      onClick={handleClick}
      disabled={(state === "downloading" && !isInsidePlugin) || !resolvedUrl || (isInsidePlugin && downloadStatus === 'downloading')}
      aria-label={`${isInsidePlugin ? 'Add' : 'Download'} ${fileName || "file"}`}
    >
      {getIcon()}
      {size !== "compact" && (
        <span className={styles.text}>
          {getLabel()}
        </span>
      )}
    </button>
  );
}

