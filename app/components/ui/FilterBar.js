"use client";

import { Filter, ArrowUpDown } from "lucide-react";
import styles from "./FilterBar.module.css";

export default function FilterBar({
  formats = [],
  selectedFormat,
  onFormatChange,
  sortBy = "newest",
  onSortChange,
}) {
  return (
    <div className={styles.bar} id="filter-bar">
      <div className={styles.filters}>
        <Filter size={16} className={styles.icon} />
        <button
          className={`${styles.chip} ${!selectedFormat ? styles.active : ""}`}
          onClick={() => onFormatChange?.(null)}
        >
          All
        </button>
        {formats.map((format) => (
          <button
            key={format}
            className={`${styles.chip} ${selectedFormat === format ? styles.active : ""}`}
            onClick={() => onFormatChange?.(format)}
          >
            .{format}
          </button>
        ))}
      </div>

      <div className={styles.sort}>
        <ArrowUpDown size={14} />
        <select
          value={sortBy}
          onChange={(e) => onSortChange?.(e.target.value)}
          className={styles.select}
          id="sort-select"
        >
          <option value="newest">Newest</option>
          <option value="popular">Most Downloaded</option>
          <option value="name">Name A-Z</option>
        </select>
      </div>
    </div>
  );
}
