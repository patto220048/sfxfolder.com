"use client";

import { Download as DownloadCount } from "lucide-react";
import DownloadButton from "./DownloadButton";
import styles from "./ResourceCard.module.css";

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function ResourceCard({
  id,
  name,
  fileUrl,
  fileFormat,
  fileSize,
  tags = [],
  downloadCount = 0,
  previewUrl,
  thumbnailUrl,
  index = 0,
}) {
  return (
    <div
      className={styles.card}
      style={{ "--stagger-index": index }}
      id={`resource-${id}`}
    >
      {/* Thumbnail / Preview area */}
      <div className={styles.preview}>
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={name} className={styles.thumbnail} />
        ) : (
          <div className={styles.placeholderThumb}>
            <span className={styles.formatBig}>{fileFormat?.toUpperCase()}</span>
          </div>
        )}
        <div className={styles.formatBadge}>{fileFormat}</div>
      </div>

      {/* Info */}
      <div className={styles.info}>
        <h3 className={styles.name} title={name}>{name}</h3>

        <div className={styles.meta}>
          <span className={styles.size}>{formatSize(fileSize)}</span>
          <span className={styles.downloads}>
            <DownloadCount size={12} />
            {downloadCount.toLocaleString()}
          </span>
        </div>

        {tags.length > 0 && (
          <div className={styles.tags}>
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className={styles.tag}>{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Download */}
      <div className={styles.actions}>
        <DownloadButton fileUrl={fileUrl} fileName={name} resourceId={id} />
      </div>
    </div>
  );
}
