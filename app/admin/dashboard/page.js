"use client";

import { useState, useEffect } from "react";
import { FileText, Download, FolderTree, TrendingUp } from "lucide-react";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
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
        // Count resources
        const resSnap = await getDocs(collection(db, "resources"));
        const resources = resSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const totalResources = resources.length;
        const totalDownloads = resources.reduce((sum, r) => sum + (r.downloadCount || 0), 0);

        // Count folders
        const folderSnap = await getDocs(collection(db, "folders"));
        const totalFolders = folderSnap.size;

        // Recent resources (last 5)
        const recentResources = [...resources]
          .sort((a, b) => {
            const aTime = a.createdAt?.seconds || 0;
            const bTime = b.createdAt?.seconds || 0;
            return bTime - aTime;
          })
          .slice(0, 5);

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
