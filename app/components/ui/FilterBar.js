"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Filter, ArrowUpDown, ChevronDown, Search, X, Tag, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./FilterBar.module.css";

export default function FilterBar({
  formats = [],
  selectedFormats = [],
  onFormatsChange,
  tags = [],
  selectedTags = [],
  onTagsChange,
  sortBy = "newest",
  onSortChange,
  inPageSearch = "",
  onSearchChange,
  resSlug,
  onClearRes,
  breadcrumbs = [],
  categoryName = "",
  onBreadcrumbClick,
  primaryColor = "var(--premium-gold)",
}) {
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

  const toggleFormat = (format) => {
    const isSelected = selectedFormats.includes(format);
    if (isSelected) {
      onFormatsChange(selectedFormats.filter((f) => f !== format));
    } else {
      onFormatsChange([...selectedFormats, format]);
    }
  };

  const toggleTag = (tag) => {
    const isSelected = selectedTags.includes(tag);
    if (isSelected) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const sortOptions = [
    { value: "newest", label: "Newest" },
    { value: "popular", label: "Most Downloaded" },
    { value: "name", label: "Name A-Z" },
  ];

  const currentSortLabel = sortOptions.find((o) => o.value === sortBy)?.label || "Sort";

  return (
    <div className={styles.container} id="filter-bar">
      <div className={styles.topRow}>
        <div className={styles.leftGroup}>
          <div className={styles.breadcrumbWrapper}>
            <button 
              className={styles.breadcrumbBtn} 
              onClick={() => {
                onBreadcrumbClick?.(null);
                onFormatsChange([]);
                onTagsChange([]);
              }}
              title={`Back to all ${categoryName}`}
            >
              <Filter size={14} className={styles.breadcrumbIcon} />
              <span className={styles.breadcrumbText}>{categoryName}</span>
            </button>
            
            {breadcrumbs.map((bc, idx) => (
              <div key={bc.id} className={styles.breadcrumbPiece}>
                <span className={styles.breadcrumbSep}>/</span>
                <button 
                  className={`${styles.breadcrumbBtn} ${idx === breadcrumbs.length - 1 ? styles.activeBreadcrumb : ""}`}
                  onClick={() => onBreadcrumbClick?.(bc.id)}
                >
                  {bc.name}
                </button>
              </div>
            ))}
          </div>

          <div className={styles.chipGroup}>
            {resSlug && (
              <button
                className={`${styles.chip} ${styles.activeChip}`}
                onClick={onClearRes}
                style={{ "--active-color": primaryColor }}
              >
                Focused
              </button>
            )}

            {formats.map((format) => (
              <button
                key={format}
                className={`${styles.chip} ${
                  selectedFormats.includes(format) ? styles.activeChip : ""
                }`}
                onClick={() => toggleFormat(format)}
                style={{ "--active-color": primaryColor }}
              >
                .{format}
                {selectedFormats.includes(format) && (
                  <Check size={10} className={styles.checkIcon} />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.rightGroup}>
          <div className={styles.searchWrapper}>
            <AnimatePresence>
              {isSearchExpanded ? (
                <motion.div
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

      {tags.length > 0 && (
        <div className={styles.tagsRow}>
          <div className={styles.labelSection}>
            <Tag size={12} className={styles.labelIcon} />
            <span className={styles.labelText}>TAGS</span>
            {selectedTags.length > 0 && (
              <button 
                className={styles.clearTagsBtn} 
                onClick={() => onTagsChange([])}
                title="Clear all tags"
              >
                <X size={10} />
              </button>
            )}
          </div>
          <div className={styles.tagsScroll}>
            <AnimatePresence mode="popLayout">
              {tags.map((tag, idx) => (
                <motion.button
                  key={tag}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ 
                    duration: 0.2, 
                    delay: Math.min(idx * 0.02, 0.2),
                    ease: "easeOut" 
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`${styles.tagChip} ${selectedTags.includes(tag) ? styles.activeTag : ""}`}
                  onClick={() => toggleTag(tag)}
                  style={{ "--active-color": primaryColor }}
                >
                  {tag}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
