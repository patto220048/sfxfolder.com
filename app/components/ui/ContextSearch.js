/* eslint-disable */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, X, History, Volume2 } from "lucide-react";
import { getIcon } from "@/app/components/ui/IconLib";
import { searchResourcesClient } from "@/app/lib/searchUtils";
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
  const [focusedId, setFocusedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

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
    e.stopPropagation(); // Prevent selecting the item
    setRecentItems(prev => {
      const updated = prev.filter(i => i.id !== itemId);
      localStorage.setItem("context_search_recent", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    setQuery("");
    setResults([]);
    setActiveIndex(0);
    setFocusedId(null);
    window.dispatchEvent(new CustomEvent("local-search", { detail: "" }));
  }, []);

  // Instant fuzzy search
  useEffect(() => {
    if (!visible) return;

    if (focusedId) {
      setResults([]);
      return;
    }

    if (!query.trim()) {
      setResults(recentItems);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    debounceRef.current = setTimeout(async () => {
      try {
        const found = await searchResourcesClient(query);
        const formatted = found.map(item => ({
          ...item,
          categoryIcon: item.categoryIcon || 'box'
        }));
        setResults(formatted.slice(0, 8));
        setActiveIndex(0);
      } catch (e) {
        console.error("Search error:", e);
      }
      setLoading(false);
    }, 50);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, visible, recentItems, focusedId]);

  useEffect(() => {
    const handleContextMenu = (e) => {
      if (
        window.location.pathname === "/" ||
        window.location.pathname.startsWith("/admin") ||
        window.location.pathname === "/terms" ||
        window.location.pathname === "/privacy" ||
        window.location.pathname === "/about-us" ||
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

    const handleKeyDown = (e) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [close]);

  const handleItemClick = (item) => {
    saveRecent(item);
    
    // Always redirect to category page with ?res=slug for all items
    // This ensures isolation/move-to-top works on the main grid
    // Resolve category slug from various possible structures (direct DB or transformed search item)
    const categorySlug = 
      item.categorySlug || 
      item.category?.slug || 
      item.categories?.slug || 
      (typeof item.category === 'string' ? item.category.toLowerCase().replace(/\s+/g, '-') : null);

    if (categorySlug) {
      window.location.href = `/${categorySlug}?res=${item.slug}`;
      close();
    } else {
      // Fallback for audio if category slug missing, though it shouldn't be
      const isAudio = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'audio'].includes(item.fileFormat?.toLowerCase()) || 
                      ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'audio'].includes(item.format?.toLowerCase());
      if (isAudio) {
        setFocusedId(item.id);
        setQuery("");
      }
    }
  };

  const handleKeyDown = (e) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, (displayList.length || 1) - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
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
  };

  if (!visible) return null;

  const displayList = focusedId 
    ? [results.find(i => i.id === focusedId) || recentItems.find(i => i.id === focusedId)].filter(Boolean)
    : results;

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${focusedId ? styles.isFocused : ""}`}
      style={{ left: position.x, top: position.y }}
    >
      <div className={styles.searchBox}>
        {focusedId ? <Volume2 size={16} className={styles.focusIcon} /> : <Search size={16} className={styles.searchIcon} />}
        <input
          ref={inputRef}
          type="text"
          placeholder={focusedId ? "Focused on Audio..." : "Quick search..."}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (focusedId) setFocusedId(null);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className={styles.input}
          id="context-search-input"
        />
        {focusedId ? (
          <button onClick={() => setFocusedId(null)} className={styles.clearBtn} title="Clear filter">
            <X size={14} />
          </button>
        ) : (
          <kbd className={styles.kbd}>ESC</kbd>
        )}
      </div>

      {!query && !focusedId && recentItems.length > 0 && (
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
        <ul className={styles.results}>
          {displayList.map((item, idx) => (
            <li
              key={item.id}
              className={`${styles.resultItem} ${idx === activeIndex && !focusedId ? styles.active : ""} ${focusedId === item.id ? styles.focusedItem : ""}`}
              onMouseEnter={() => !focusedId && setActiveIndex(idx)}
              onClick={() => handleItemClick(item)}
            >
              <span className={styles.resultIcon}>
                {getCategoryIcon(item.categoryIcon)}
              </span>
              <div className={styles.resultItemContent}>
                <div className={styles.resultName}>
                  {highlightText(item.name, (query.trim() && !focusedId) ? item.matches : [], 'name')}
                </div>
                <div className={styles.resultMeta}>
                  {item.format && <span className={styles.resultFormat}>{item.format.toUpperCase()}</span>}
                  {item.fileFormat && item.fileFormat !== item.format && <span className={styles.resultFormat}>{item.fileFormat.toUpperCase()}</span>}
                  {item.category && (
                    <>
                      <span className={styles.dot}>•</span>
                      <span className={styles.folder}>{item.category.toUpperCase()}</span>
                    </>
                  )}
                  <span className={styles.dot}>•</span>
                  <span className={styles.action}>
                    {focusedId === item.id ? "CLICK TO UNLOCK" : "CLICK TO OPEN"}
                  </span>
                </div>
              </div>
              {!query && !focusedId && (
                <button 
                  className={styles.removeBtn} 
                  onClick={(e) => removeRecent(e, item.id)}
                  title="Remove from history"
                >
                  <X size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!loading && query && results.length === 0 && !focusedId && (
        <div className={styles.empty}>No results found</div>
      )}

      <div className={styles.hint}>
        <span>↑↓ navigate</span>
        <span>↵ select</span>
        {focusedId ? <span>esc exit focus</span> : <span>esc close</span>}
      </div>
    </div>
  );
}
