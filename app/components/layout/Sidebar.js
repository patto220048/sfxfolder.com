"use client";

import { useState } from "react";
import { ChevronRight, Menu, X } from "lucide-react";
import TreeFolder from "@/app/components/ui/TreeFolder";
import styles from "./Sidebar.module.css";

export default function Sidebar({
  categoryName,
  folders = [],
  selectedFolderId,
  onSelectFolder,
  primaryColor = "#00F0FF",
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
        style={{ "--cat-color": primaryColor }}
      >
        <div className={styles.header}>
          <h3 className={styles.title}>{categoryName || "Folders"}</h3>
        </div>

        <div className={styles.content}>
          {/* "All" option */}
          <button
            className={`${styles.allBtn} ${!selectedFolderId ? styles.allActive : ""}`}
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
            selectedFolderId={selectedFolderId}
            onSelect={(folder) => {
              onSelectFolder?.(folder);
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
