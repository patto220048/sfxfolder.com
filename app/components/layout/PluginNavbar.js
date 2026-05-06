"use client";
import { Home, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./PluginNavbar.module.css";

export default function PluginNavbar({ breadcrumbs = [], categoryName = "", onBreadcrumbClick }) {
  const router = useRouter();
  
  const handleReload = () => {
    // Clear API data cache to force a fresh load from server
    if (typeof window !== 'undefined') {
      localStorage.removeItem('plugin_data_v1');
    }
    window.location.reload();
  };

  return (
    <div className={styles.navGroup}>
      <div className={styles.buttons}>
        <button onClick={() => router.back()} className={styles.iconBtn} title="Back">
          <ChevronLeft size={14} />
        </button>
        <button onClick={() => router.forward()} className={styles.iconBtn} title="Forward">
          <ChevronRight size={14} />
        </button>
        <button onClick={handleReload} className={styles.iconBtn} title="Refresh">
          <RefreshCw size={14} />
        </button>
        <button onClick={() => onBreadcrumbClick?.(null)} className={styles.iconBtn} title="Category Home">
          <Home size={14} />
        </button>
      </div>

      <div className={styles.divider} />

      <div className={styles.path}>
        <button 
          className={styles.pathItem}
          onClick={() => onBreadcrumbClick?.(null)}
        >
          {categoryName}
        </button>
        
        {breadcrumbs.map((bc) => (
          <div key={bc.id} className={styles.pathSegment}>
            <ChevronRight size={12} className={styles.sep} />
            <button 
              className={styles.pathItem}
              onClick={() => onBreadcrumbClick?.(bc.id)}
            >
              {bc.name}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

