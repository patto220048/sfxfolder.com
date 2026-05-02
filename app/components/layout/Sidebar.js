/* eslint-disable */
"use client";

import { memo, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronRight, Menu, X } from "lucide-react";
import { useSidebar } from "@/app/context/SidebarContext";



import TreeFolder from "@/app/components/ui/TreeFolder";
import styles from "./Sidebar.module.css";

const MIN_WIDTH = 200;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 260;

const Sidebar = memo(function Sidebar({
  categorySlug,
  categoryName,
  folders = [],
  selectedFolderId,
  onSelectFolder,
  primaryColor = "#FFFFFF",
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedFolderId: contextFolderId } = useSidebar();
  
  const urlFolderId = searchParams?.get("folder");
  const effectiveFolderId = selectedFolderId || contextFolderId || urlFolderId;


  const [mobileOpen, setMobileOpen] = useState(false);

  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const sidebarRef = useRef(null);

  // Load width from localStorage and sync CSS variable on mount
  useEffect(() => {
    const savedWidth = localStorage.getItem("sidebarWidth");
    let initialWidth = DEFAULT_WIDTH;
    
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
        initialWidth = parsed;
        setWidth(parsed);
      }
    }
    
    // Set CSS variable immediately to prevent layout shifts in components that depend on it
    document.documentElement.style.setProperty('--sidebar-width', `${initialWidth}px`);
    
    // Enable transitions immediately — CSS variable is already set
    setIsReady(true);
  }, []);

  // Update CSS variable when width changes during resize
  useEffect(() => {
    if (isResizing && typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
    }
  }, [width, isResizing]);

  const startResizing = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    localStorage.setItem("sidebarWidth", width.toString());
  }, [width]);

  const resize = useCallback(
    (e) => {
      if (isResizing) {
        let newWidth = e.clientX;
        if (newWidth < MIN_WIDTH) newWidth = MIN_WIDTH;
        if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH;
        setWidth(newWidth);
      }
    },
    [isResizing]
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
      // Add class to body to prevent text selection and keep cursor style consistent
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
    }

    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

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
        ref={sidebarRef}
        className={`${styles.sidebar} ${mobileOpen ? styles.open : ""} ${
          isResizing ? styles.isResizing : ""
        } ${isReady ? styles.isReady : ""}`}
        id="category-sidebar"
        data-lenis-prevent
        style={{ 
          "--cat-color": primaryColor,
          width: mobileOpen ? undefined : `${width}px` 
        }}
      >
        {/* Resize Handle */}
        <div className={styles.resizer} onMouseDown={startResizing} />
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
            <span style={{ flex: 1 }}>All Resources</span>
            {(() => {
              const total = folders.reduce((acc, f) => acc + (f.totalResourceCount || 0), 0);
              return total > 0 ? (
                <span className={styles.allCount}>{total}</span>
              ) : null;
            })()}
          </button>

          <TreeFolder
            folders={folders}
            selectedFolderId={effectiveFolderId}
            onSelect={(folder) => {
              if (onSelectFolder) {
                onSelectFolder(folder);
              } else {
                // Default navigation logic for Sidebar when used in a Layout
                const params = new URLSearchParams(searchParams.toString());
                if (folder) {
                  params.set("folder", folder.id);
                } else {
                  params.delete("folder");
                }
                // When in a layout, we typically want to go back to the category root list view
                router.push(`/${categorySlug || ""}?${params.toString()}`);
              }
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
});

export default Sidebar;
