/* eslint-disable */
"use client";

import { memo, useState, useRef, useCallback, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download as DownloadCount, Play, Eye, Volume2, VolumeX, Star } from "lucide-react";
import DownloadButton from "./DownloadButton";
import { usePluginCache } from "@/app/hooks/usePluginCache";
import { mediaManager } from "@/app/lib/mediaManager";
import { isVideoFormat, isImageFormat, isFontFormat, isLUTFormat, getOptimizedUrl } from "@/app/lib/mediaUtils";
import { useFavorites } from "@/app/context/FavoritesContext";
import styles from "./ResourceCard.module.css";

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

const ResourceCard = memo(function ResourceCard({
  id,
  categoryId,
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
  gradedThumbnailUrl,
  gradedPreviewUrl,
  cardType = "default",
  index = 0,
  onPreview,
  detailUrl,
  primaryColor = "#FFFFFF",
  isPlugin = false,
  isHighlighted = false,
  isScrolling = false,
  ...otherProps
}) {
  const router = useRouter();
  const { isFavorited, toggleFavorite } = useFavorites();
  const isFav = isFavorited(id);

  const { downloadStatus, cachedPath } = usePluginCache(isPlugin ? id : null, name || fileName, fileFormat);
  const isDraggable = isPlugin && downloadStatus === 'cached' && cachedPath;

  const handleDragStart = useCallback((e) => {
    if (isDraggable && cachedPath) {
      const fileUrl = 'file:///' + cachedPath.replace(/\\/g, '/');
      const safeName = (name || fileName || "download").replace(/[:/\\?*|"]/g, "_");
      const ext = fileFormat || "mp4";
      const fullFileName = safeName.endsWith("." + ext) ? safeName : `${safeName}.${ext}`;
      let mimeType = 'application/octet-stream';
      let icon = '📦';
      if (['mp4', 'mov', 'webm'].includes(ext.toLowerCase())) {
        mimeType = 'video/mp4';
        icon = '🎬';
      } else if (['jpg', 'jpeg', 'png', 'gif'].includes(ext.toLowerCase())) {
        mimeType = 'image/png';
        icon = '🎨';
      }
      
      const downloadUrlData = `${mimeType}:${fullFileName}:${fileUrl}`;
      const cleanPath = cachedPath.replace(/\\/g, '/');
      
      e.dataTransfer.setData("DownloadURL", downloadUrlData);
      e.dataTransfer.setData("text/plain", cachedPath);
      e.dataTransfer.setData("com.adobe.cep.dnd.file.0", cleanPath);
      e.dataTransfer.effectAllowed = "copy";

      // Create a premium custom drag image
      if (typeof document !== 'undefined') {
        const dragImage = document.createElement("div");
        dragImage.style.position = "absolute";
        dragImage.style.top = "-100px";
        dragImage.style.left = "-100px";
        dragImage.style.padding = "6px 12px";
        dragImage.style.background = "#141414";
        dragImage.style.color = "#FFFFFF";
        dragImage.style.border = "1px solid #FFFFFF";
        dragImage.style.fontFamily = "var(--font-mono), 'JetBrains Mono', monospace";
        dragImage.style.fontSize = "10px";
        dragImage.style.letterSpacing = "0.05em";
        dragImage.style.textTransform = "uppercase";
        dragImage.style.pointerEvents = "none";
        dragImage.style.whiteSpace = "nowrap";
        dragImage.style.display = "flex";
        dragImage.style.alignItems = "center";
        dragImage.style.gap = "6px";
        dragImage.style.zIndex = "9999";
        
        dragImage.innerHTML = `<span>${icon}</span> <span>${fullFileName}</span>`;
        
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 20, 15);
        
        setTimeout(() => {
          if (document.body.contains(dragImage)) {
            document.body.removeChild(dragImage);
          }
        }, 0);
      }
    }
  }, [isDraggable, cachedPath, name, fileName, fileFormat]);

  const handleFavoriteClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(id, categoryId);
  }, [id, categoryId, toggleFavorite]);

  const resourceObj = { id, name, fileName, fileFormat, downloadUrl, ...otherProps };
  
  // Determine effective card type based on format if not explicitly set to something else
  const effectiveCardType = useMemo(() => {
    if (cardType !== "default" && cardType !== "preview") return cardType;
    if (isVideoFormat(resourceObj)) return "video";
    if (isImageFormat(resourceObj)) return "image";
    if (isFontFormat(resourceObj)) return "font";
    if (isLUTFormat(resourceObj)) return "lut";
    return cardType;
  }, [cardType, resourceObj]);
  const resolvedUrl = downloadUrl || fileUrl;
  const [isHovering, setIsHovering] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Default to muted for stable hydration
  const [volume, setVolume] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef(null);
  const rafRef = useRef(null);
  const wasPlayingRef = useRef(false);
  const displayName = (name || fileName || "Untitled").replace(/\.[^/.]+$/, "");

  // LUT Slider comparison state
  const [sliderPos, setSliderPos] = useState(50);
  const lutContainerRef = useRef(null);

  const handleLutMouseMove = useCallback((e) => {
    if (!lutContainerRef.current) return;
    const rect = lutContainerRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
    setSliderPos(percentage);
  }, []);

  const handleLutMouseLeave = useCallback(() => {
    setSliderPos(50);
  }, []);

  // Sync with mediaManager after hydration
  useEffect(() => {
    setIsMuted(mediaManager.getMuted('video'));
    setVolume(mediaManager.getVolume('video'));
  }, []);

  // Video progress updater via rAF
  const updateVideoProgress = useCallback(() => {
    const video = videoRef.current;
    if (video && !video.paused && video.duration && !isScrubbing) {
      setVideoProgress((video.currentTime / video.duration) * 100);
      rafRef.current = requestAnimationFrame(updateVideoProgress);
    }
  }, [isScrubbing]);

  const seek = useCallback((clientX, target) => {
    const video = videoRef.current;
    if (!video) return;
    
    // Use native duration with NaN check
    const videoDuration = (video.duration && !isNaN(video.duration) && video.duration > 0) 
      ? video.duration 
      : null;

    if (!videoDuration) return;

    const rect = target.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, offsetX / rect.width));
    
    video.currentTime = ratio * videoDuration;
    setVideoProgress(ratio * 100);
  }, []);

  const handleMouseDown = useCallback((e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    // Pause while scrubbing
    wasPlayingRef.current = !video.paused;
    if (!video.paused) {
      video.pause();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }

    setIsScrubbing(true);
    seek(e.clientX, e.currentTarget);
  }, [seek]);

  // Handle global scrubbing events for video
  useEffect(() => {
    if (!isScrubbing) return;

    const handleMouseMove = (e) => {
      // Find the progress wrapper within this specific card
      const wrapper = document.querySelector(`#resource-${id} .${styles.videoProgressWrapper}`);
      if (wrapper) seek(e.clientX, wrapper);
    };

    const handleMouseUp = () => {
      setIsScrubbing(false);
      
      const video = videoRef.current;
      if (video && wasPlayingRef.current) {
        mediaManager.play(video, 'video', () => {
          setVideoProgress(0);
        });
        video.play().then(() => {
          if (!rafRef.current) rafRef.current = requestAnimationFrame(updateVideoProgress);
        }).catch(() => {});
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isScrubbing, id, seek]);

  // --- Audio inline player ---
  const toggleAudio = useCallback(() => {
    const audio = mediaManager.getSharedAudio();
    if (!audio || !resolvedUrl) return;

    if (isPlaying && mediaManager.isIdActive(id)) {
      audio.pause();
      setIsPlaying(false);
      mediaManager.stop(audio);
    } else {
      // Register with global media manager
      mediaManager.play(audio, 'audio', () => {
        setIsPlaying(false);
      }, id);

      // Only update src if it's different to allow seamless handover
      const currentSrc = audio.src ? new URL(audio.src, window.location.href).href : "";
      const targetSrc = new URL(resolvedUrl, window.location.href).href;
      
      if (currentSrc !== targetSrc) {
        audio.src = resolvedUrl;
        audio.load();
      }

      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying, id, resolvedUrl]);

  // Sync audio/video state with global manager
  useEffect(() => {
    const audio = mediaManager.getSharedAudio();
    
    const handleTimeUpdate = () => {
      if (mediaManager.isIdActive(id)) {
        setCurrentTime(audio.currentTime);
      }
    };
    const handleDurationChange = () => {
      if (mediaManager.isIdActive(id)) {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      if (mediaManager.isIdActive(id)) {
        setIsPlaying(false);
        setCurrentTime(0);
        mediaManager.stop(audio);
      }
    };

    const unsubscribe = mediaManager.subscribe(({ activeMediaId }) => {
      if (activeMediaId === id) {
        setIsPlaying(!audio.paused);
        setDuration(audio.duration);
        setCurrentTime(audio.currentTime);
        
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('durationchange', handleDurationChange);
        audio.addEventListener('ended', handleEnded);
      } else {
        if (isPlaying) setIsPlaying(false);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('durationchange', handleDurationChange);
        audio.removeEventListener('ended', handleEnded);
      }
    });

    // Initial check for handover
    if (mediaManager.isIdActive(id)) {
      setIsPlaying(!audio.paused);
      setDuration(audio.duration);
      setCurrentTime(audio.currentTime);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('durationchange', handleDurationChange);
      audio.addEventListener('ended', handleEnded);
    }

    return () => {
      unsubscribe();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [id]);

  // Sync with global settings
  useEffect(() => {
    const unsubscribe = mediaManager.subscribe((settings) => {
      setIsMuted(settings.video.muted);
      setVolume(settings.video.volume);
    });
    return unsubscribe;
  }, []);

  const hoverTimeoutRef = useRef(null);

  // Cancel hover immediately when scrolling starts (except for LUT cards to prevent image stutter/reset)
  useEffect(() => {
    if (isScrolling && effectiveCardType !== "lut") {
      setIsHovering(false);
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
    }
  }, [isScrolling, effectiveCardType]);

  // Cleanup timeout and video state on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  // Video playback on hover - DISABLED as per user request
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isHovering && !isScrolling) {
      // Auto-play disabled. Video will only show if rendered, but not play automatically.
    } else {
      video.pause();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
  }, [isHovering, isScrolling, updateVideoProgress]);

  const handleMouseEnter = () => {
    if (isScrolling && effectiveCardType !== "lut") return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovering(true);
    }, 200);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovering(false);
  };

  const renderPreview = () => {
    switch (effectiveCardType) {
      case "video":
        return (
          <div className={styles.preview}>
            {!!thumbnailUrl ? (
              <>
                {!isScrolling && isHovering && resolvedUrl ? (
                  <video
                    ref={videoRef}
                    className={styles.videoPreview}
                    src={resolvedUrl}
                    muted
                    playsInline
                    loop
                    poster={getOptimizedUrl(thumbnailUrl, { width: 480 })}
                    preload="metadata"
                  />
                ) : (
                  <Image
                    src={getOptimizedUrl(thumbnailUrl, { width: 480 })}
                    alt={displayName}
                    fill
                    className={styles.cardImage}
                    priority={index < 4}
                    onError={(e) => {
                      // Fallback to original URL if optimized one fails
                      e.target.src = thumbnailUrl;
                    }}
                  />
                )}
              </>
            ) : !isScrolling && (effectiveCardType === "video" || isVideoFormat(resourceObj)) && resolvedUrl ? (
              <video
                ref={videoRef}
                src={`${resolvedUrl}#t=0.1`}
                className={styles.videoPreview}
                loop
                muted
                playsInline
                preload="metadata"
                poster={""}
              />
            ) : (thumbnailUrl || resolvedUrl) ? (
              <Image
                src={getOptimizedUrl(thumbnailUrl || resolvedUrl, { width: 480 })}
                alt={displayName}
                fill
                className={styles.cardImage}
                priority={index < 4}
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
            {!isScrolling && (isHovering || isScrubbing) && (
              <div 
                className={styles.videoProgressWrapper} 
                onMouseDown={handleMouseDown}
                style={{ height: isScrubbing ? '6px' : undefined }}
              >
                <div className={styles.videoProgressTrack}>
                  <div
                    className={styles.videoProgressFill}
                    style={{ width: `${videoProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Volume Control */}
            {!isScrolling && isHovering && effectiveCardType === "video" && (
              <div className={styles.volumeControl} onClick={(e) => e.stopPropagation()}>
                <button 
                  className={styles.volumeBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    const newMuted = !isMuted;
                    setIsMuted(newMuted);
                    mediaManager.setMuted(newMuted, 'video');
                  }}
                >
                  {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setVolume(val);
                    if (val > 0) {
                      setIsMuted(false);
                      mediaManager.setMuted(false, 'video');
                    }
                    mediaManager.setVolume(val, 'video');
                  }}
                  className={styles.volumeSlider}
                />
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
                src={getOptimizedUrl(previewUrl || thumbnailUrl || resolvedUrl, { width: 480 })}
                alt={displayName}
                fill
                className={styles.cardImage}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                priority={index < 4}
                onError={(e) => {
                  e.target.src = previewUrl || thumbnailUrl || resolvedUrl;
                }}
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

      case "lut":
        const hasGraded = !!(gradedThumbnailUrl || gradedPreviewUrl);
        const originalImg = thumbnailUrl || previewUrl || "/images/samples/portrait.png";
        const gradedImg = gradedThumbnailUrl || gradedPreviewUrl;

        return (
          <div 
            ref={lutContainerRef}
            className={`${styles.preview} ${hasGraded ? styles.lutPreviewContainer : ""}`}
            onMouseMove={hasGraded ? handleLutMouseMove : undefined}
            onMouseLeave={hasGraded ? handleLutMouseLeave : undefined}
          >
            <div className={styles.lutCardHeader}>
              <span className={styles.lutTypeBadge}>LUT PRESET</span>
            </div>

            {hasGraded ? (
              <div className={styles.lutComparisonWrapper}>
                {/* Original Image (Base) */}
                <Image
                  src={getOptimizedUrl(originalImg, { width: 480 })}
                  alt={displayName}
                  fill
                  className={styles.cardImage}
                  style={{ objectFit: 'cover', zIndex: 1 }}
                  priority={index < 4}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  onError={(e) => {
                    e.target.src = originalImg;
                  }}
                />

                {/* Graded Image (Overlay) */}
                <div 
                  className={styles.lutGradedOverlay}
                  style={{
                    inset: 0,
                    zIndex: 2,
                    clipPath: `inset(0 0 0 ${sliderPos}%)`,
                    transition: isHovering ? 'none' : 'clip-path 0.2s ease-out'
                  }}
                >
                  <Image
                    src={getOptimizedUrl(gradedImg, { width: 480 })}
                    alt={`${displayName} Graded`}
                    fill
                    className={styles.cardImage}
                    style={{ objectFit: 'cover' }}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    onError={(e) => {
                      e.target.src = gradedImg;
                    }}
                  />
                </div>

                {/* Slider bar & handle */}
                <div 
                  className={styles.lutSliderLine}
                  style={{
                    left: `${sliderPos}%`,
                    transition: isHovering ? 'none' : 'left 0.2s ease-out'
                  }}
                >
                  <div className={styles.lutSliderHandle}>
                    <div className={styles.lutSliderHandleBars}>
                      <div className={styles.lutSliderHandleBar} />
                      <div className={styles.lutSliderHandleBar} />
                    </div>
                  </div>
                </div>

                {/* Badges for Original / Graded */}
                <div 
                  className={styles.lutLabels}
                  style={{
                    opacity: isHovering ? 1 : 0
                  }}
                >
                  <span className={styles.lutLabel}>ORIGINAL</span>
                  <span className={styles.lutLabel}>GRADED</span>
                </div>
              </div>
            ) : (
              // Fallback for legacy LUT resources without pre-graded outputs
              <Image
                src={getOptimizedUrl(originalImg, { width: 480 })}
                alt={displayName}
                fill
                className={styles.cardImage}
                style={{ objectFit: 'cover', zIndex: 1 }}
                priority={index < 4}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                onError={(e) => {
                  e.target.src = originalImg;
                }}
              />
            )}

            <div className={styles.formatBadge}>{fileFormat?.toUpperCase() || "LUT"}</div>
          </div>
        );

      case "preview":
        return (
          <div className={styles.preview}>
            {(previewUrl || thumbnailUrl) ? (
              <Image
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                src={getOptimizedUrl(previewUrl || thumbnailUrl, { width: 480 })}
                alt={displayName}
                className={styles.thumbnail}
                loading={index < 4 ? undefined : "lazy"}
                priority={index < 4}
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
              <Image 
                fill 
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" 
                src={getOptimizedUrl(thumbnailUrl, { width: 480 })} 
                alt={displayName} 
                className={styles.thumbnail} 
                loading={index < 4 ? undefined : "lazy"}
                priority={index < 4}
              />
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
      className={`${styles.card} ${isPlugin ? styles.pluginCard : ""} ${isHighlighted ? styles.highlighted : ""} ${effectiveCardType === 'sound' ? styles.soundCard : ""} ${isDraggable ? styles.draggableCard : ""}`}
      style={{ 
        "--stagger-index": index,
        "--cat-color": primaryColor
      }}
      draggable={isDraggable ? "true" : undefined}
      onDragStart={isDraggable ? handleDragStart : undefined}
      id={`resource-${id}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isPlugin ? (
        <>
          {/* Compact Left: Small Thumbnail */}
          <div className={styles.compactPreview} onClick={() => onPreview && onPreview()}>
            {thumbnailUrl ? (
              <Image 
                width={64}
                height={44}
                src={getOptimizedUrl(thumbnailUrl, { width: 120 })} 
                alt={displayName} 
                className={styles.compactThumbnail} 
              />
            ) : (
              <div className={styles.compactPlaceholder}>
                <span>{fileFormat?.toUpperCase().slice(0, 3)}</span>
              </div>
            )}
            <div className={styles.compactPlayIcon}>
              <Play size={10} fill="currentColor" />
            </div>
          </div>

          {/* Compact Middle: Info */}
          <div className={styles.compactInfo} onClick={() => onPreview && onPreview()}>
            <h3 className={styles.compactName} title={name}>{displayName}</h3>
            <div className={styles.compactMeta}>
              {fileFormat && <span className={styles.format}>{fileFormat}</span>}
              <span className={styles.size}>{formatSize(fileSize)}</span>
            </div>
          </div>

          {/* Compact Right: Actions */}
          <div className={styles.compactActions}>
            <button 
              type="button"
              className={`${styles.compactFavoriteBtn} ${isFav ? styles.active : ""}`}
              onClick={handleFavoriteClick}
              title={isFav ? "Remove from Favorites" : "Add to Favorites"}
            >
              <Star size={13} fill={isFav ? "#FFD93D" : "none"} />
            </button>
            <DownloadButton 
              downloadUrl={resolvedUrl} 
              fileName={name || fileName} 
              fileFormat={fileFormat} 
              resourceId={id} 
              isPlugin={isPlugin}
              size="minimal"
            />
          </div>
        </>
      ) : (
        <>
          <div className={styles.previewWrapper}>
            <div className={styles.previewClickArea} onClick={() => onPreview && onPreview()}>
              {renderPreview()}
            </div>
            <button 
              type="button"
              className={`${styles.favoriteBtn} ${isFav ? styles.active : ""}`}
              onClick={handleFavoriteClick}
              title={isFav ? "Remove from Favorites" : "Add to Favorites"}
            >
              <Star size={16} fill={isFav ? "#FFD93D" : "none"} />
            </button>
          </div>

          <div className={styles.info} onClick={() => onPreview && onPreview()}>
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
            {!isPlugin && (onPreview || detailUrl) && (
              <button
                type="button"
                className={styles.detailBtn}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (detailUrl) {
                    router.push(detailUrl);
                  } else if (onPreview) {
                    onPreview();
                  }
                }}
                title="View details"
              >
                <Eye size={16} />
              </button>
            )}
            <DownloadButton 
              downloadUrl={resolvedUrl} 
              fileName={name || fileName} 
              fileFormat={fileFormat} 
              resourceId={id} 
              isPlugin={isPlugin}
            />
          </div>
        </>
      )}
    </div>
  );
});

export default ResourceCard;
