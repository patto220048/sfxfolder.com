"use client";

import { memo } from "react";
import { Folder, CornerUpLeft } from "lucide-react";
import styles from "./FolderCard.module.css";

const FolderCard = memo(function FolderCard({ 
  folder, 
  onClick, 
  isBack = false, 
  primaryColor = "#FACB11",
  index = 0,
  isScrolling = false
}) {
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? 
      `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : 
      "250, 203, 17";
  };

  const rgb = hexToRgb(primaryColor);

  return (
    <div 
      className={`${styles.card} ${isBack ? styles.isBack : ""}`}
      onClick={onClick}
      style={{ 
        "--cat-color": primaryColor,
        "--cat-color-rgb": rgb,
        animationDelay: (isScrolling || isBack) ? "0s" : `${index * 0.05}s`
      }}
    >
      <div className={styles.iconWrapper}>
        {isBack ? (
          <CornerUpLeft size={40} strokeWidth={1.5} />
        ) : (
          <Folder size={40} strokeWidth={1.5} fill={primaryColor} fillOpacity={0.1} />
        )}
      </div>
      
      <div className={styles.info}>
        <span className={styles.name}>
          {isBack ? "Back to Parent" : folder.name}
        </span>
        {!isBack && folder.totalResourceCount > 0 && (
          <span className={styles.count}>
            {folder.totalResourceCount} {folder.totalResourceCount === 1 ? "item" : "items"}
          </span>
        )}
      </div>
    </div>
  );
});

export default FolderCard;
