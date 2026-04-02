"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, FileAudio, Film, Image, Type, SlidersHorizontal } from "lucide-react";
import styles from "./ContextSearch.module.css";

const DEMO_RESULTS = [
  { id: 1, name: "Whoosh Transition", category: "sound-effects", format: "mp3" },
  { id: 2, name: "Boom Impact", category: "sound-effects", format: "wav" },
  { id: 3, name: "Meme Dance", category: "video-meme", format: "mp4" },
  { id: 4, name: "Fire Green Screen", category: "green-screen", format: "mp4" },
  { id: 5, name: "Neon Glow Overlay", category: "image-overlay", format: "png" },
];

function getCategoryIcon(cat) {
  const size = 14;
  switch (cat) {
    case "sound-effects": case "music": return <FileAudio size={size} />;
    case "video-meme": case "green-screen": case "animation": return <Film size={size} />;
    case "image-overlay": return <Image size={size} />;
    case "font": return <Type size={size} />;
    case "preset-lut": return <SlidersHorizontal size={size} />;
    default: return <FileAudio size={size} />;
  }
}

export default function ContextSearch() {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const filtered = query
    ? DEMO_RESULTS.filter((r) =>
        r.name.toLowerCase().includes(query.toLowerCase())
      )
    : DEMO_RESULTS;

  const close = useCallback(() => {
    setVisible(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  useEffect(() => {
    const handleContextMenu = (e) => {
      // Don't override on admin pages or input elements
      if (
        window.location.pathname.startsWith("/admin") ||
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA"
      ) {
        return;
      }

      e.preventDefault();

      // Smart positioning: avoid overflow
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

  const handleKeyDown = (e) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[activeIndex]) {
          // Navigate to resource or download
          window.location.href = `/${filtered[activeIndex].category}`;
          close();
        }
        break;
    }
  };

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      className={styles.container}
      style={{ left: position.x, top: position.y }}
    >
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
          onKeyDown={handleKeyDown}
          className={styles.input}
          id="context-search-input"
        />
        <kbd className={styles.kbd}>ESC</kbd>
      </div>

      {filtered.length > 0 && (
        <ul className={styles.results}>
          {filtered.map((item, idx) => (
            <li
              key={item.id}
              className={`${styles.resultItem} ${idx === activeIndex ? styles.active : ""}`}
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => {
                window.location.href = `/${item.category}`;
                close();
              }}
            >
              <span className={styles.resultIcon}>
                {getCategoryIcon(item.category)}
              </span>
              <span className={styles.resultName}>{item.name}</span>
              <span className={styles.resultFormat}>{item.format}</span>
            </li>
          ))}
        </ul>
      )}

      {query && filtered.length === 0 && (
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
