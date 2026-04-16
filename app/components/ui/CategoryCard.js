"use client";

import { useState } from "react";
import Link from "next/link";
import { getIcon } from "./IconLib";
import styles from "./CategoryCard.module.css";

export default function CategoryCard({ name, slug, icon, color, resourceCount = 0, index = 0 }) {
  const [isNavigating, setIsNavigating] = useState(false);
  const IconComponent = getIcon(icon);

  const handleClick = (e) => {
    if (isNavigating) {
      e.preventDefault();
      return;
    }
    setIsNavigating(true);
    // Timeout safety
    setTimeout(() => setIsNavigating(false), 2000);
  };

  return (
    <Link
      href={`/${slug}`}
      className={`${styles.card} ${isNavigating ? styles.navigating : ""}`}
      style={{
        "--card-color": color,
        "--pulse-color": `${color}33`,
        "--stagger-index": index,
      }}
      onClick={handleClick}
      id={`category-card-${slug}`}
    >
      <div className={styles.iconWrap}>
        <IconComponent size={28} strokeWidth={1.8} />
      </div>
      <h3 className={styles.name}>
        {name} {resourceCount > 0 && `(${resourceCount})`}
      </h3>
      <span className={styles.count}>
        {isNavigating ? "Loading..." : resourceCount > 0 ? "Browse library" : "Coming soon"}
      </span>
      <div className={styles.glow} />
    </Link>
  );
}
