'use client';

import React, { memo, useState, useRef, useEffect } from 'react';
import { Search, X, ArrowUpDown, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from '../page.module.css';

/**
 * NavigationHeader Component
 * Handles folder history navigation and the category/folder title.
 */
const NavigationHeader = ({ 
  selectedFolderId, 
  resetToRoot, 
  goBack, 
  goForward, 
  historyPointer, 
  historyStack, 
  info,
  breadcrumbs = [],
  onBreadcrumbClick,
  inPageSearch = "",
  onSearchChange,
  sortBy = "newest",
  onSortChange
}) => {
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(inPageSearch.length > 0);
  const sortRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-expand search if an external query comes in
  useEffect(() => {
    if (inPageSearch.length > 0) {
      setIsSearchExpanded(true);
    }
  }, [inPageSearch]);

  const sortOptions = [
    { value: "newest", label: "Newest" },
    { value: "popular", label: "Most Downloaded" },
    { value: "name", label: "Name A-Z" },
  ];

  const currentSortLabel = sortOptions.find((o) => o.value === sortBy)?.label || "Sort";

  return (
    <div className={`${styles.pageHeader} ${isSearchExpanded ? styles.searchExpanded : ""}`}>
      <div className={styles.leftGroup}>
        <div className={styles.navActions}>
          <button 
            className={styles.navBtn} 
            onClick={resetToRoot} 
            title="Home Root"
            disabled={selectedFolderId === null}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </button>
          <div className={styles.navArrows}>
            <button 
              className={styles.navBtn} 
              onClick={goBack} 
              disabled={historyPointer <= 0}
              title="Back"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>
            <button 
              className={styles.navBtn} 
              onClick={goForward} 
              disabled={historyPointer >= historyStack.length - 1}
              title="Forward"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>
          </div>
        </div>
        
        <span className={styles.headerSep}>|</span>

        <div className={styles.breadcrumbTitle}>
          {selectedFolderId ? (
            <>
              <button 
                className={styles.breadcrumbLink} 
                onClick={resetToRoot}
                title={`Back to all ${info.name}`}
              >
                {info.name}
              </button>
              {breadcrumbs.map((bc, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={bc.id}>
                    <span className={styles.breadcrumbSep}>/</span>
                    {isLast ? (
                      <h1 className={styles.activeTitle} style={{ color: info.color }}>
                        {bc.name}
                      </h1>
                    ) : (
                      <button 
                        className={styles.breadcrumbLink}
                        onClick={() => onBreadcrumbClick?.(bc.id)}
                      >
                        {bc.name}
                      </button>
                    )}
                  </React.Fragment>
                );
              })}
            </>
          ) : (
            <h1 className={styles.activeTitle} style={{ color: info.color }}>
              {info.name}
            </h1>
          )}
        </div>
      </div>

      <div className={styles.rightGroup}>
        <div className={styles.searchWrapper}>
          <AnimatePresence>
            {isSearchExpanded ? (
              <motion.div
                key="search-input-container"
                initial={{ width: 40, opacity: 0 }}
                animate={{ width: 220, opacity: 1 }}
                exit={{ width: 40, opacity: 0 }}
                className={styles.searchBar}
              >
                <Search size={14} className={styles.searchInnerIcon} />
                <input
                  ref={searchInputRef}
                  autoFocus
                  type="text"
                  placeholder="Search in category..."
                  value={inPageSearch}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className={styles.searchInput}
                />
                <button
                  onClick={() => {
                    onSearchChange("");
                    setIsSearchExpanded(false);
                  }}
                  className={styles.searchClose}
                >
                  <X size={14} />
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="search-btn"
                onClick={() => setIsSearchExpanded(true)}
                className={styles.iconButton}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                title="Search in this category"
              >
                <Search size={18} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <div className={styles.sortWrapper} ref={sortRef}>
          <button
            className={`${styles.sortTrigger} ${isSortOpen ? styles.sortOpen : ""}`}
            onClick={() => setIsSortOpen(!isSortOpen)}
          >
            <ArrowUpDown size={14} />
            <span>{currentSortLabel}</span>
            <ChevronDown size={14} className={styles.chevron} />
          </button>

          <AnimatePresence>
            {isSortOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className={styles.sortMenu}
              >
                {sortOptions.map((opt) => (
                  <button
                    key={opt.value}
                    className={`${styles.sortItem} ${sortBy === opt.value ? styles.activeSortItem : ""}`}
                    onClick={() => {
                      onSortChange(opt.value);
                      setIsSortOpen(false);
                    }}
                  >
                    {opt.label}
                    {sortBy === opt.value && <Check size={14} className={styles.checkIcon} />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default memo(NavigationHeader);
