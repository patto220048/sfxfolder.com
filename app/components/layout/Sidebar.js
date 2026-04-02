"use client";

import { useState } from "react";
import { ChevronRight, Menu, X } from "lucide-react";
import TreeFolder from "@/app/components/ui/TreeFolder";
import styles from "./Sidebar.module.css";

export default function Sidebar({
  categoryName,
  folders = [],
  selectedPath,
  onSelectFolder,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        className={styles.mobileToggle}
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle sidebar"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        <span>Folders</span>
      </button>

      <aside
        className={`${styles.sidebar} ${mobileOpen ? styles.open : ""}`}
        id="category-sidebar"
      >
        <div className={styles.header}>
          <h3 className={styles.title}>{categoryName || "Folders"}</h3>
        </div>

        <div className={styles.content}>
          {/* "All" option */}
          <button
            className={`${styles.allBtn} ${!selectedPath ? styles.allActive : ""}`}
            onClick={() => {
              onSelectFolder?.(null);
              setMobileOpen(false);
            }}
          >
            <ChevronRight size={14} />
            <span>All Resources</span>
          </button>

          <TreeFolder
            folders={folders}
            selectedPath={selectedPath}
            onSelect={(path) => {
              onSelectFolder?.(path);
              setMobileOpen(false);
            }}
          />
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className={styles.overlay} onClick={() => setMobileOpen(false)} />
      )}
    </>
  );
}
