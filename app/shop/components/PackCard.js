import Link from "next/link";
import { Package, Check, Database } from "lucide-react";
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
  } = pack;

  // Check if new (created less than 7 days ago)
  const isNew = created_at
    ? (new Date() - new Date(created_at)) / (1000 * 60 * 60 * 24) < 7
    : false;

  const formattedSize = total_size
    ? `${(total_size / 1024 / 1024).toFixed(1)} MB`
    : "0 MB";

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
      </div>

      {/* CONTENT */}
      <div className={styles.content}>
        <span className={styles.category}>{pack.category || "Audio Pack"}</span>
        <h3 className={styles.name}>{name}</h3>
        <p className={styles.shortDescription}>{short_description}</p>

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
