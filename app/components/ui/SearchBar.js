"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./SearchBar.module.css";

export default function SearchBar({ size = "default", placeholder = "Search resources..." }) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form
      className={`${styles.form} ${size === "large" ? styles.large : ""}`}
      onSubmit={handleSubmit}
      id="search-bar"
    >
      <Search size={size === "large" ? 22 : 18} className={styles.icon} />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className={styles.input}
        id="search-input"
      />
      <button type="submit" className={styles.button}>
        Search
      </button>
    </form>
  );
}
