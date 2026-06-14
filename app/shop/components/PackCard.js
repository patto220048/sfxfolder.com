"use client";

import Link from "next/link";
import { Package, Check, Database, Star } from "lucide-react";
import styles from "./PackCard.module.css";

export default function PackCard({ pack, isPurchased }) {
  const {
    id,
    name,
    slug,
    short_description,
    price,
    original_price,
    cover_image,
    is_featured,
    item_count,
    total_size,
    created_at,
    average_rating,
    review_count,
  } = pack;

  // Check if new (created less than 7 days ago)
  const isNew = created_at
    ? (new Date() - new Date(created_at)) / (1000 * 60 * 60 * 24) < 7
    : false;

  const formattedSize = total_size
    ? `${(total_size / 1024 / 1024).toFixed(1)} MB`
    : "0 MB";

  const handleBuyNow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = `/shop/checkout?packId=${id}`;
  };

  return (
    <Link href={`/shop/${slug}`} className={styles.card}>
      {/* BADGES */}
      <div className={styles.badgeContainer}>
        {isPurchased && (
          <span className={`${styles.badge} ${styles.purchasedBadge}`}>
            <Check size={12} /> Owned
          </span>
        )}
        {is_featured && (
          <span className={`${styles.badge} ${styles.featuredBadge}`}>
            Featured
          </span>
        )}
        {isNew && !isPurchased && (
          <span className={`${styles.badge} ${styles.newBadge}`}>New</span>
        )}
      </div>

      {/* COVER IMAGE */}
      <div className={styles.imageWrapper}>
        {cover_image ? (
          <img src={cover_image} alt={name} className={styles.coverImage} />
        ) : (
          <div className={styles.coverPlaceholder}>
            <Package size={36} />
          </div>
        )}

        {/* Hover overlay quick checkout */}
        {!isPurchased && price > 0 && (
          <div className={styles.hoverOverlay}>
            <button className={styles.buyNowBtn} onClick={handleBuyNow}>
              Buy Now
            </button>
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div className={styles.content}>
        <span className={styles.category}>{pack.category || "Audio Pack"}</span>
        <h3 className={styles.name}>{name}</h3>
        <p className={styles.shortDescription}>{short_description}</p>

        {review_count > 0 && (
          <div className={styles.ratingRow} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8rem", color: "var(--premium-gold)", fontWeight: 700, marginBottom: "8px" }}>
            <Star size={12} fill="var(--premium-gold)" color="var(--premium-gold)" />
            <span>{average_rating} ({review_count})</span>
          </div>
        )}

        <div className={styles.footer}>
          <div className={styles.meta}>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Package size={12} /> {item_count || 0} items
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Database size={12} /> {formattedSize}
            </span>
          </div>

          <div className={styles.priceContainer}>
            {price > 0 ? (
              <>
                {original_price && (
                  <span className={styles.originalPrice}>
                    ${original_price}
                  </span>
                )}
                <span className={styles.price}>${price}</span>
              </>
            ) : (
              <span className={styles.freePrice}>FREE</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
