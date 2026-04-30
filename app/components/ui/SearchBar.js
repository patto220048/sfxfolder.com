"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { getIcon } from "./IconLib";
import styles from "./SearchBar.module.css";

export default function SearchBar({ size = "default", placeholder = "Search resources..." }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const router = useRouter();
  const pathname = usePathname();
  const dropdownRef = useRef(null);
  const debounceTimer = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = async (val) => {
    if (val.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`/api/search/suggestions?q=${encodeURIComponent(val)}`);
      const data = await resp.json();
      setSuggestions(data.results || []);
      setShowDropdown(true);
    } catch (e) {
      console.error("Suggestions error:", e);
    }
    setLoading(false);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setActiveIndex(-1);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 300);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      const selected = suggestions[activeIndex];
      navigateToResource(selected);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const navigateToResource = (item) => {
    if (item.type === 'folder') {
      const categorySlug = item.categorySlug || 'all';
      router.push(`/${categorySlug}?folder=${item.id}`);
      setShowDropdown(false);
      setQuery("");
      return;
    }

    const isHome = pathname === "/";
    let url = `/${item.categorySlug}`;
    
    const params = new URLSearchParams();
    if (item.slug) params.set("res", item.slug);
    if (item.folderId) params.set("folder", item.folderId);
    
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
    
    router.push(url);
    setShowDropdown(false);
    setQuery("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      setShowDropdown(false);
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div className={styles.wrapper} ref={dropdownRef}>
      <form
        className={`${styles.form} ${size === "large" ? styles.large : ""}`}
        onSubmit={handleSubmit}
        id="search-bar"
      >
        <Search size={size === "large" ? 22 : 18} className={styles.icon} />
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setShowDropdown(true)}
          placeholder={placeholder}
          className={styles.input}
          autoComplete="off"
          id="search-input"
        />
        {loading && <Loader2 size={size === "large" ? 20 : 16} className={styles.loader} />}
        {!loading && query && (
          <button type="submit" className={styles.button}>
            Search
          </button>
        )}
      </form>

      {showDropdown && suggestions.length > 0 && (
        <ul className={styles.dropdown}>
          {suggestions.map((item, idx) => {
            const Icon = getIcon(item.categoryIcon);
            return (
              <li
                key={item.id}
                className={`${styles.dropdownItem} ${idx === activeIndex ? styles.active : ""}`}
                onClick={() => navigateToResource(item)}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                <span className={styles.itemIcon}>
                  <Icon size={16} />
                </span>
                <div className={styles.itemContent}>
                  <div className={styles.itemName}>{item.name}</div>
                  <div className={styles.itemMeta}>
                    {item.type === 'folder' ? (
                      <span className={styles.folderBadge}>FOLDER</span>
                    ) : (
                      item.format && <span className={styles.format}>{item.format.toUpperCase()}</span>
                    )}
                    {item.folderName && item.type !== 'folder' && (
                      <>
                        <span className={styles.dot}>•</span>
                        <span className={styles.folder}>{item.folderName.toUpperCase()}</span>
                      </>
                    )}
                    <span className={styles.dot}>•</span>
                    <span className={styles.action}>CLICK TO OPEN</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
