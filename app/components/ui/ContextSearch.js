/* eslint-disable */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, X, History, Volume2, Filter, ChevronDown, Check, Eye, Folder, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getIcon } from "@/app/components/ui/IconLib";
import { searchResourcesClient, getOrBuildSearchIndex } from "@/app/lib/searchUtils";
import styles from "./ContextSearch.module.css";

function getCategoryIcon(iconName, size = 16) {
  const Icon = getIcon(iconName);
  return <Icon size={size} />;
}

// Helper to highlight matched text
function highlightText(text, matches = [], keyName) {
  if (!text) return null;
  // If no matches provided or empty, just return text
  if (!matches || matches.length === 0) return text;
  
  const match = matches.find(m => m.key === keyName);
  if (!match || !match.indices || match.indices.length === 0) {
    return text;
  }

  const elements = [];
  let lastIndex = 0;
  match.indices.forEach(([start, end], idx) => {
    if (start > lastIndex) {
      elements.push(<span key={`text-${idx}`}>{text.substring(lastIndex, start)}</span>);
    }
    elements.push(
      <mark key={`mark-${idx}`} className={styles.highlight}>
        {text.substring(start, end + 1)}
      </mark>
    );
    lastIndex = end + 1;
  });

  if (lastIndex < text.length) {
    elements.push(<span key={`text-last`}>{text.substring(lastIndex)}</span>);
  }

  return <>{elements}</>;
}

export default function ContextSearch() {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [recentItems, setRecentItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeFolder, setActiveFolder] = useState(null);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [filters, setFilters] = useState({
    category: "",
    type: "all"
  });
  
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const listRef = useRef(null);
  const debounceRef = useRef(null);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[activeIndex];
      if (activeEl) {
        activeEl.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [activeIndex]);

  // Load recent items from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("context_search_recent");
      if (saved) {
        try {
          setRecentItems(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to load recent items", e);
        }
      }
    }
  }, []);

  // Load categories and formats when visible
  useEffect(() => {
    if (!visible) return;

    const loadIndexData = async () => {
      try {
        const fuse = await getOrBuildSearchIndex();
        // Handle different Fuse.js versions/structures
        const list = fuse.list || (fuse.getIndex && fuse.getIndex().docs) || [];
        
        console.log("ContextSearch: Index loaded, items:", list.length);
        
        if (list.length > 0) {
          // Get unique categories with counts
          const catMap = {};
          const fmtMap = {};
          
          list.forEach(item => {
            // Some items might be wrapped in { item: ... } if they came from a search result, 
            // but fuse.list should be raw.
            const data = item.item || item; 
            const cat = data.category || data.category_id;
            const fmt = data.fileFormat || data.file_format || data.format;
            
            if (cat) catMap[cat] = (catMap[cat] || 0) + 1;
            if (fmt) fmtMap[fmt] = (fmtMap[fmt] || 0) + 1;
          });
          
          const cats = Object.entries(catMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

          setAvailableCategories(cats);
        }
      } catch (e) {
        console.error("Failed to load search index data:", e);
      }
    };
    loadIndexData();
  }, [visible]);

  const saveRecent = useCallback((item) => {
    if (!item) return;
    setRecentItems(prev => {
      // Create a clean version of the item without search metadata
      const { matches, score, ...cleanItem } = item;
      const filtered = prev.filter(i => i.id !== item.id);
      const updated = [cleanItem, ...filtered].slice(0, 4);
      localStorage.setItem("context_search_recent", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeRecent = useCallback((e, itemId) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent selecting the item
    
    setRecentItems(prev => {
      const updated = prev.filter(i => i.id !== itemId);
      localStorage.setItem("context_search_recent", JSON.stringify(updated));
      
      // If we are currently showing recent items (no query/filters), 
      // update the displayed results immediately for better UX
      if (!query.trim() && !filters.category && !activeFolder && filters.type === 'all') {
        setResults(updated);
      }
      
      return updated;
    });
  }, [query, filters, activeFolder]);

  const close = useCallback(() => {
    setVisible(false);
    setQuery("");
    setResults([]);
    setActiveIndex(0);
    setActiveFolder(null); // Clear folder context on close
    setFilters(prev => ({ ...prev, type: 'all' })); // Reset type filter on close
    window.dispatchEvent(new CustomEvent("local-search", { detail: "" }));
  }, []);

  useEffect(() => {
    if (!visible) return;

    if (!query.trim() && !filters.category && !activeFolder && filters.type === 'all') {
      setResults(recentItems);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    debounceRef.current = setTimeout(async () => {
      // Sync with background grid
      window.dispatchEvent(new CustomEvent("local-search", { detail: query }));
      
      try {
        let found = await searchResourcesClient(query, {
          category: filters.category,
          type: filters.type,
          folderId: activeFolder?.id,
          limit: 20
        });
        
        const formatted = found.map(item => ({
          ...item,
          categoryIcon: item.categoryIcon || 'box'
        }));
        setResults(formatted);
        setActiveIndex(0);
      } catch (e) {
        console.error("Search error:", e);
      }
      setLoading(false);
    }, 50);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, visible, recentItems, filters.category, filters.type, activeFolder]);

  const handleItemClick = useCallback((item) => {
    saveRecent(item);
    
    if (item.type === 'folder') {
      setActiveFolder(item);
      setFilters(prev => ({ ...prev, type: 'resource' }));
      setQuery(""); // Clear search to show folder content
      inputRef.current?.focus();
      return;
    }

    const categorySlug = item.categorySlug || 
                         (typeof item.category === 'string' ? item.category.toLowerCase().replace(/\s+/g, '-') : 'all');
    const itemSlug = item.slug;
    const folderId = item.folderId;

    if (categorySlug && itemSlug) {
      // Navigate to category page with folder and resource parameters
      let url = `/${categorySlug}?res=${itemSlug}`;
      if (folderId) {
        url += `&folder=${folderId}`;
      }
      window.location.href = url;
      close();
    }
  }, [saveRecent, close]);

  const handleKeyDown = useCallback((e) => {
    const displayList = results;
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, (displayList.length || 1) - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "ArrowRight":
        {
          const currentItem = displayList[activeIndex];
          if (currentItem?.type === 'folder') {
            e.preventDefault();
            handleItemClick(currentItem);
          }
        }
        break;
      case "ArrowLeft":
        if (activeFolder) {
          e.preventDefault();
          setActiveFolder(null);
          setFilters(prev => ({ ...prev, type: 'all' }));
          setQuery("");
        }
        break;
      case "Enter":
        e.preventDefault();
        if (displayList[activeIndex]) {
          handleItemClick(displayList[activeIndex]);
        } else if (query.trim()) {
          window.location.href = `/search?q=${encodeURIComponent(query.trim())}`;
          close();
        }
        break;
    }
  }, [results, activeIndex, activeFolder, handleItemClick, query, close]);

  useEffect(() => {
    const handleContextMenu = (e) => {
      if (
        window.location.pathname === "/" ||
        window.location.pathname.startsWith("/admin") ||
        window.location.pathname === "/terms" ||
        window.location.pathname === "/privacy" ||
        window.location.pathname === "/about-us" ||
        window.location.pathname === "/contact" ||
        window.location.pathname === "/pricing" ||
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA"
      ) {
        return;
      }

      e.preventDefault();
      const x = Math.min(e.clientX, window.innerWidth - 340);
      const y = Math.min(e.clientY, window.innerHeight - 360);

      setPosition({ x, y });
      setVisible(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    };

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        close();
      }
    };

    const handleGlobalKeyDown = (e) => {
      if (!visible) return;

      // Prioritize keys when search is open
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Escape"].includes(e.key)) {
        e.preventDefault();
        
        if (e.key === "Escape") {
          close();
          return;
        }

        // If focus was lost (e.g. clicked outside), bring it back to input
        if (document.activeElement !== inputRef.current && e.target.tagName !== "INPUT") {
          inputRef.current?.focus();
        }
        
        // Handle navigation through our logic
        handleKeyDown(e);
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleGlobalKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [close, visible, handleKeyDown]);

  const handleNavigate = (e, item) => {
    e.stopPropagation(); // Prevent trigger row click
    saveRecent(item);
    
    if (item.type === 'folder') {
      const categorySlug = item.categorySlug || 'all';
      window.location.href = `/${categorySlug}?folder=${item.id}`;
      close();
      return;
    }

    const categorySlug = item.categorySlug || 
                         (typeof item.category === 'string' ? item.category.toLowerCase().replace(/\s+/g, '-') : 'all');
    const itemSlug = item.slug;

    if (categorySlug && itemSlug) {
      // Direct navigation to dedicated details page
      window.location.href = `/${categorySlug}/${itemSlug}`;
      close();
    }
  };

  if (!visible) return null;

  const displayList = results;

  return (
    <div
      ref={containerRef}
      className={styles.container}
      style={{ left: position.x, top: position.y }}
      data-lenis-prevent
    >
      <AnimatePresence>
        {activeFolder && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={styles.folderContext}
          >
            <div className={styles.folderContextLabel}>
              <Folder size={12} className={styles.folderIcon} />
              <span className={styles.folderName}>{activeFolder.name}</span>
              <button 
                className={styles.clearFolder} 
                onClick={() => {
                  setActiveFolder(null);
                  setFilters(prev => ({ ...prev, type: 'all' }));
                }}
                title="Clear folder context"
              >
                <X size={12} />
              </button>
            </div>
            <ChevronRight size={14} className={styles.contextArrow} />
            <span className={styles.contextHint}>Searching in folder</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={styles.searchBox}>
        <Search size={16} className={styles.searchIcon} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Quick search..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          className={styles.input}
          id="context-search-input"
        />
        <div className={styles.searchActions}>
          <button 
            className={`${styles.filterToggle} ${showAdvanced ? styles.activeFilter : ""}`} 
            onClick={() => setShowAdvanced(!showAdvanced)}
            title="Advanced Search"
          >
            <Filter size={14} />
          </button>
          <kbd className={styles.kbd}>ESC</kbd>
        </div>
      </div>

      {showAdvanced && (
        <div className={styles.advancedPanel}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Result Type</span>
            <div className={styles.filterScroll}>
              {['all', 'resource', 'folder'].map(type => (
                <button
                  key={type}
                  className={`${styles.filterChip} ${filters.type === type ? styles.activeChip : ""}`}
                  onClick={() => setFilters(prev => ({ ...prev, type }))}
                >
                  {type === 'all' ? 'All Results' : type === 'resource' ? 'Resources' : 'Folders'}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterGroup}>
            <div className={styles.filterLabel}>Category</div>
            <div className={styles.filterScroll}>
              <button 
                className={`${styles.filterChip} ${!filters.category ? styles.activeChip : ""}`}
                onClick={() => setFilters(f => ({ ...f, category: "" }))}
              >
                All
              </button>
              {availableCategories.map(cat => (
                <button 
                  key={cat.name}
                  className={`${styles.filterChip} ${filters.category === cat.name ? styles.activeChip : ""}`}
                  onClick={() => setFilters(f => ({ ...f, category: cat.name }))}
                >
                  {cat.name} <span className={styles.chipCount}>{cat.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!query && recentItems.length > 0 && (
        <div className={styles.sectionHeader}>
          <History size={10} />
          <span>RECENT SEARCHES</span>
        </div>
      )}

      {loading && (
        <div className={styles.empty}>
          <Loader2 size={14} className={styles.spin} />
          <span style={{ marginLeft: "6px" }}>Searching...</span>
        </div>
      )}

      {!loading && displayList.length > 0 && (
        <ul ref={listRef} className={styles.results} data-lenis-prevent>
          {displayList.map((item, idx) => (
            <li
              key={item.id}
              className={`${styles.resultItem} ${idx === activeIndex ? styles.active : ""}`}
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => handleItemClick(item)}
            >
              <span className={styles.resultIcon}>
                {getCategoryIcon(item.type === 'folder' ? 'folder' : (item.categoryIcon || 'box'))}
              </span>
              <div className={styles.resultItemContent}>
                <div className={styles.resultName}>
                  {highlightText(item.name, query.trim() ? item.matches : [], 'name')}
                </div>
                <div className={styles.resultMeta}>
                  {item.type === 'folder' ? (
                    <span className={styles.folderBadge}>FOLDER</span>
                  ) : (
                    <>
                      {item.format && <span className={styles.resultFormat}>{item.format.toUpperCase()}</span>}
                      {item.fileFormat && item.fileFormat !== item.format && <span className={styles.resultFormat}>{item.fileFormat.toUpperCase()}</span>}
                    </>
                  )}
                  {item.category && (
                    <>
                      <span className={styles.dot}>•</span>
                      <span className={styles.categoryName}>{item.category.toUpperCase()}</span>
                    </>
                  )}
                </div>
              </div>
              <div className={styles.resultActions}>
                <button 
                  className={styles.viewBtn} 
                  onClick={(e) => handleNavigate(e, item)}
                  title="View Details"
                >
                  <Eye size={14} />
                </button>
                {!query && (
                  <button 
                    className={styles.removeBtn} 
                    onClick={(e) => removeRecent(e, item.id)}
                    title="Remove from history"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && query && results.length === 0 && (
        <div className={styles.empty}>No results found</div>
      )}

      <div className={styles.hint}>
        <span>↑↓ navigate</span>
        <span>↵ select</span>
        <span>esc close</span>
      </div>
    </div>
  );
}
