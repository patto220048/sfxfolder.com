"use client";

import Link from "next/link";
import {
  Volume2, Music, Film, Monitor,
  Sparkles, ImageIcon, Type, SlidersHorizontal,
} from "lucide-react";
import styles from "./CategoryCard.module.css";

const iconMap = {
  "volume-2": Volume2,
  music: Music,
  film: Film,
  monitor: Monitor,
  sparkles: Sparkles,
  image: ImageIcon,
  type: Type,
  sliders: SlidersHorizontal,
};

export default function CategoryCard({ name, slug, icon, color, resourceCount = 0, index = 0 }) {
  const IconComponent = iconMap[icon] || Volume2;

  return (
    <Link
      href={`/${slug}`}
      className={styles.card}
      style={{
        "--card-color": color,
        "--pulse-color": `${color}33`,
        "--stagger-index": index,
      }}
      id={`category-card-${slug}`}
    >
      <div className={styles.iconWrap}>
        <IconComponent size={28} strokeWidth={1.8} />
      </div>
      <h3 className={styles.name}>
        {name} {resourceCount > 0 && `(${resourceCount})`}
      </h3>
      <span className={styles.count}>
        {resourceCount > 0 ? "Browse library" : "Coming soon"}
      </span>
      <div className={styles.glow} />
    </Link>
  );
}
