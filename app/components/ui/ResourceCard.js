"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { Download as DownloadCount, Play, Eye } from "lucide-react";
import DownloadButton from "./DownloadButton";
import { mediaManager } from "@/app/lib/mediaManager";
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
  downloadUrl,
  fileUrl,
  fileName,
  fileFormat,
  fileSize,
  tags = [],
  downloadCount = 0,
  previewUrl,
  thumbnailUrl,
  cardType = "default",
  index = 0,
}) {
  const resolvedUrl = downloadUrl || fileUrl;
  const [isHovering, setIsHovering] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const videoRef = useRef(null);
  const rafRef = useRef(null);
  const displayName = (name || fileName || "Untitled").replace(/\.[^/.]+$/, "");

  // Video progress updater via rAF
  const updateVideoProgress = useCallback(() => {
    const video = videoRef.current;
    if (video && !video.paused && video.duration) {
      setVideoProgress((video.currentTime / video.duration) * 100);
      rafRef.current = requestAnimationFrame(updateVideoProgress);
    }
  }, []);

  const handleProgressClick = useCallback((e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    
    // Ensure we use the actual native duration
    const videoDuration = video.duration;
    if (!videoDuration) return;

    // Utilize native offset
    const offsetX = e.nativeEvent.offsetX;
    const totalWidth = e.currentTarget.offsetWidth;
    const ratio = Math.max(0, Math.min(1, offsetX / totalWidth));
    
    video.currentTime = ratio * videoDuration;
    setVideoProgress(ratio * 100);
  }, []);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (cardType === "video" && videoRef.current) {
      mediaManager.play(videoRef.current, () => {
        setVideoProgress(0);
      });
      const p = videoRef.current.play();
      if (p !== undefined) {
        p.then(() => {
          rafRef.current = requestAnimationFrame(updateVideoProgress);
        }).catch((err) => {
          if (err.name !== "AbortError") console.error(err);
        });
      }
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (cardType === "video" && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      mediaManager.stop(videoRef.current);
      setVideoProgress(0);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
  };

  const renderPreview = () => {
    switch (cardType) {
      case "video":
        return (
          <div className={styles.preview}>
            {thumbnailUrl ? (
              <>
                {isHovering && resolvedUrl ? (
                  <video
                    ref={videoRef}
                    src={resolvedUrl}
                    className={styles.videoPreview}
                    muted
                    loop
                    playsInline
                    preload="none"
                  />
                ) : (
                  <Image fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" src={thumbnailUrl} alt={displayName} className={styles.thumbnail} />
                )}
              </>
            ) : resolvedUrl ? (
              <video
                ref={videoRef}
                src={resolvedUrl}
                className={styles.videoPreview}
                muted
                loop
                playsInline
                preload="none"
              />
            ) : (
              <div className={styles.placeholderThumb}>
                <Play size={32} className={styles.playOverlay} />
                <span className={styles.formatBig}>{fileFormat?.toUpperCase()}</span>
              </div>
            )}
            {!isHovering && (thumbnailUrl || resolvedUrl) && (
              <div className={styles.playBadge}>
                <Play size={16} />
              </div>
            )}
            {/* Video Progress Bar */}
            {isHovering && (
              <div className={styles.videoProgressWrapper} onClick={handleProgressClick}>
                <div className={styles.videoProgressTrack}>
                  <div
                    className={styles.videoProgressFill}
                    style={{ width: `${videoProgress}%` }}
                  />
                </div>
              </div>
            )}
            <div className={styles.formatBadge}>{fileFormat}</div>
          </div>
        );

      case "image":
        return (
          <div className={styles.preview}>
            {(previewUrl || thumbnailUrl || resolvedUrl) ? (
              <Image
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                src={previewUrl || thumbnailUrl || resolvedUrl}
                alt={displayName}
                className={styles.thumbnail}
                loading="lazy"
              />
            ) : (
              <div className={styles.placeholderThumb}>
                <Eye size={24} className={styles.playOverlay} />
                <span className={styles.formatBig}>{fileFormat?.toUpperCase()}</span>
              </div>
            )}
            <div className={styles.formatBadge}>{fileFormat}</div>
          </div>
        );

      case "font":
        return (
          <div className={styles.preview}>
            <div className={styles.fontPreview}>
              <span className={styles.fontSample}>Aa Bb Cc</span>
              <span className={styles.fontName}>{displayName}</span>
            </div>
            <div className={styles.formatBadge}>{fileFormat}</div>
          </div>
        );

      case "preview":
        return (
          <div className={styles.preview}>
            {(previewUrl || thumbnailUrl) ? (
              <Image
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                src={previewUrl || thumbnailUrl}
                alt={displayName}
                className={styles.thumbnail}
                loading="lazy"
              />
            ) : (
              <div className={styles.placeholderThumb}>
                <div className={styles.lutPreview}>
                  <div className={styles.lutStrip}>
                    <span className={styles.lutColor} style={{ background: "#ff6b6b" }} />
                    <span className={styles.lutColor} style={{ background: "#feca57" }} />
                    <span className={styles.lutColor} style={{ background: "#48dbfb" }} />
                    <span className={styles.lutColor} style={{ background: "#ff9ff3" }} />
                    <span className={styles.lutColor} style={{ background: "#54a0ff" }} />
                  </div>
                </div>
                <span className={styles.formatBig}>{fileFormat?.toUpperCase()}</span>
              </div>
            )}
            <div className={styles.formatBadge}>{fileFormat}</div>
          </div>
        );

      default:
        return (
          <div className={styles.preview}>
            {thumbnailUrl ? (
              <Image fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" src={thumbnailUrl} alt={displayName} className={styles.thumbnail} loading="lazy" />
            ) : (
              <div className={styles.placeholderThumb}>
                <span className={styles.formatBig}>{fileFormat?.toUpperCase()}</span>
              </div>
            )}
            <div className={styles.formatBadge}>{fileFormat}</div>
          </div>
        );
    }
  };

  return (
    <div
      className={styles.card}
      style={{ "--stagger-index": index }}
      id={`resource-${id}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {renderPreview()}

      <div className={styles.info}>
        <h3 className={styles.name} title={name}>{displayName}</h3>

        <div className={styles.meta}>
          <span className={styles.size}>{formatSize(fileSize)}</span>
          <span className={styles.downloads}>
            <DownloadCount size={12} />
            {(downloadCount || 0).toLocaleString()}
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

      <div className={styles.actions}>
        <DownloadButton downloadUrl={resolvedUrl} fileName={name} fileFormat={fileFormat} resourceId={id} />
      </div>
    </div>
  );
}
