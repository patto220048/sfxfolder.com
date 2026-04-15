"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { mediaManager } from "@/app/lib/mediaManager";
import DownloadButton from "./DownloadButton";
import styles from "./PreviewOverlay.module.css";

export default function PreviewOverlay({ resource, onClose, showDownload = false }) {
  const mediaRef = useRef(null);
  const [isHovering, setIsHovering] = useState(false);

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // Sync with mediaManager
  useEffect(() => {
    if (resource && mediaRef.current && ["video-meme", "green-screen", "animation"].includes(resource.category)) {
      mediaManager.play(mediaRef.current, 'video');
    }
    return () => {
      if (mediaRef.current) mediaManager.stop(mediaRef.current);
    };
  }, [resource]);

  const handleMediaEnter = () => {
    setIsHovering(true);
  };

  const handleMediaLeave = () => {
    setIsHovering(false);
  };

  if (!resource) return null;

  const categorySlug = typeof resource.category === 'string' 
    ? resource.category 
    : (resource.category?.slug || resource.category_id || "");

  return (
    <div className={styles.previewOverlay} onClick={onClose}>
      <div 
        className={styles.previewContent} 
        onClick={(e) => e.stopPropagation()}
      >
        <button className={styles.closePreview} onClick={onClose} title="Close (Esc)">
          <X size={24} />
        </button>
        
        <div 
          className={styles.previewMedia}
          onMouseEnter={handleMediaEnter}
          onMouseLeave={handleMediaLeave}
        >
          {(categorySlug.includes('video') || ["video-meme", "green-screen", "animation"].includes(categorySlug)) && (
            <video 
              ref={mediaRef}
              src={resource.downloadUrl || resource.fileUrl} 
              poster={resource.thumbnailUrl || resource.previewUrl}
              controls 
              autoPlay 
              muted
              loop
              playsInline 
              className={styles.largePreviewVideo} 
            />
          )}
          {(categorySlug.includes('image') || ["image-overlay", "graphics", "background"].includes(categorySlug)) && (
            <img 
              src={resource.downloadUrl || resource.fileUrl} 
              alt={resource.name} 
              className={styles.largePreviewImage} 
            />
          )}
          {categorySlug === "font" && (
            <div className={styles.largePreviewFont}>
               <p>ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
               <p>abcdefghijklmnopqrstuvwxyz</p>
               <p>0123456789</p>
               <p style={{ fontSize: '2.5rem', marginTop: '20px' }}>
                 The quick brown fox jumps over the lazy dog
               </p>
            </div>
          )}
          {/* Default fallback if category not matched but has fileUrl */}
          {!categorySlug.includes('video') && !categorySlug.includes('image') && 
           !["video-meme", "green-screen", "animation", "image-overlay", "graphics", "background", "font"].includes(categorySlug) && (
            <div className={styles.largePreviewFont}>
              <p>Preview not available for this type</p>
              <p style={{ fontSize: '1rem', opacity: 0.7 }}>{resource.fileName} ({categorySlug})</p>
            </div>
          )}
        </div>
        
        <div className={styles.previewInfo}>
          <div className={styles.previewHeader}>
            <h2>{resource.name || resource.fileName || "Untitled"}</h2>
            {showDownload && (
              <div className={styles.previewDownload}>
                <DownloadButton 
                  downloadUrl={resource.downloadUrl} 
                  fileUrl={resource.fileUrl}
                  fileName={resource.name || resource.fileName}
                  fileFormat={resource.fileFormat}
                  resourceId={resource.id}
                  size="compact"
                />
              </div>
            )}
          </div>

          <div className={styles.previewMeta}>
            <span className={styles.previewCategory}>{categorySlug.replace(/-/g, ' ')}</span>
            <span className={styles.previewDot}>•</span>
            <span className={styles.previewFormat}>{resource.fileFormat?.toUpperCase()}</span>
            <span className={styles.previewDot}>•</span>
            <span className={styles.previewSize}>
              {resource.fileSize ? (resource.fileSize / 1024 / 1024).toFixed(2) + ' MB' : '---'}
            </span>
          </div>

          {resource.tags && resource.tags.length > 0 && (
            <div className={styles.previewTags}>
              {resource.tags.map((tag, i) => (
                <span key={i} className={styles.previewTag}>{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
