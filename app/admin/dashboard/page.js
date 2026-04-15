"use client";

import { useState, useEffect } from "react";
import { FileText, Download, FolderTree, TrendingUp } from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import styles from "./page.module.css";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalResources: 0,
    totalDownloads: 0,
    totalFolders: 0,
    recentResources: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        // Count resources and sum downloads
        const { data: resources, error: resError } = await supabase
          .from('resources')
          .select('id, name, file_format, download_count, created_at, categories(name)')
          .order('created_at', { ascending: false });

        if (resError) throw resError;

        const totalResources = resources.length;
        const totalDownloads = resources.reduce((sum, r) => sum + (r.download_count || 0), 0);

        // Count folders
        const { count: totalFolders, error: folderError } = await supabase
          .from('folders')
          .select('*', { count: 'exact', head: true });

        if (folderError) throw folderError;

        // Recent resources (last 5 - already sorted by server)
        const recentResources = resources.slice(0, 5).map(r => ({
          id: r.id,
          name: r.name,
          category: r.categories?.name || "Uncategorized",
          fileFormat: r.file_format,
          downloadCount: r.download_count
        }));

        setStats({ totalResources, totalDownloads, totalFolders, recentResources });
      } catch (e) {
        console.error("Failed to load dashboard stats:", e.message);
      }
      setLoading(false);
    }
    loadStats();
  }, []);

  const statCards = [
    { icon: FileText, label: "Total Resources", value: stats.totalResources, color: "var(--neon-cyan)" },
    { icon: Download, label: "Total Downloads", value: stats.totalDownloads.toLocaleString(), color: "var(--neon-purple)" },
    { icon: FolderTree, label: "Total Folders", value: stats.totalFolders, color: "var(--neon-green)" },
    { icon: TrendingUp, label: "Today Downloads", value: "—", color: "var(--neon-pink)" },
  ];

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Dashboard</h1>

      <div className={styles.statsGrid}>
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={styles.statCard} style={{ "--stat-color": stat.color }}>
              <div className={styles.statIcon}>
                <Icon size={24} />
              </div>
              <div className={styles.statInfo}>
                <span className={styles.statValue}>
                  {loading ? "..." : stat.value}
                </span>
                <span className={styles.statLabel}>{stat.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Recent Resources</h2>
        {loading ? (
          <div className={styles.emptySection}>
            <p>Loading...</p>
          </div>
        ) : stats.recentResources.length > 0 ? (
          <div className={styles.recentList}>
            {stats.recentResources.map((res) => (
              <div key={res.id} className={styles.recentItem}>
                <span className={styles.recentName}>{res.name}</span>
                <span className={styles.recentMeta}>
                  {res.category} • {res.fileFormat} • {(res.downloadCount || 0).toLocaleString()} downloads
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptySection}>
            <p>No resources yet. Start by uploading resources.</p>
          </div>
        )}
      </div>
    </div>
  );
}
