"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Plus, Search, Trash2 } from "lucide-react";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import styles from "./page.module.css";

export default function AdminResources() {
  const [searchQuery, setSearchQuery] = useState("");
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(collection(db, "resources"));
        setResources(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Failed to load resources:", e.message);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return resources;
    const term = searchQuery.toLowerCase();
    return resources.filter(
      (r) =>
        r.name?.toLowerCase().includes(term) ||
        r.category?.toLowerCase().includes(term) ||
        r.tags?.some((t) => t.toLowerCase().includes(term))
    );
  }, [resources, searchQuery]);

  async function handleDelete(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "resources", id));
      setResources((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      alert("Delete failed: " + e.message);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Resources ({resources.length})</h1>
        <Link href="/admin/resources/new" className={styles.addBtn}>
          <Plus size={18} />
          Add Resource
        </Link>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <span>Name</span>
          <span>Category</span>
          <span>Format</span>
          <span>Downloads</span>
          <span>Actions</span>
        </div>

        {loading ? (
          <div className={styles.emptyTable}>
            <p>Loading resources...</p>
          </div>
        ) : filtered.length > 0 ? (
          filtered.map((r) => (
            <div key={r.id} className={styles.tableRow}>
              <span className={styles.cellName}>{r.name}</span>
              <span className={styles.cellMeta}>{r.category}</span>
              <span className={styles.cellFormat}>{r.fileFormat}</span>
              <span className={styles.cellMeta}>{(r.downloadCount || 0).toLocaleString()}</span>
              <span>
                <button
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(r.id, r.name)}
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </span>
            </div>
          ))
        ) : (
          <div className={styles.emptyTable}>
            <p>{searchQuery ? `No results for "${searchQuery}"` : "No resources yet. Click Add Resource to get started."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
