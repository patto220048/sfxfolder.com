"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, Plus, Loader2, Star } from "lucide-react";
import { useAuth } from "@/app/lib/auth-context";
import { usePluginCache } from "@/app/hooks/usePluginCache";
import { incrementDownloadCount } from "@/app/lib/api";
import { mediaManager } from "@/app/lib/mediaManager";
import { isVideoFormat, isImageFormat, isFontFormat, isAudioFormat } from "@/app/lib/mediaUtils";
import { useFavorites } from "@/app/context/FavoritesContext";
import styles from "./SoundButton.module.css";

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatTime(seconds) {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SoundButton = memo(function SoundButton({
  id,
  categoryId,
  name,
  fileName,
  downloadUrl,
  fileFormat,
  fileSize,
  downloadCount = 0,
  index = 0,
  onPreview,
  primaryColor = "#FFFFFF",
  isPremium,
  similarity,
  isPlugin = false,
  isHighlighted = false,
  isScrolling = false,
  ...otherProps
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const pendingSeekRatioRef = useRef(null);
  
  const { 
    downloadStatus, 
    progress: pluginProgress, 
    isInsidePlugin, 
    importAsset, 
    downloadResource,
    cachedPath
  } = usePluginCache(id, name || fileName, fileFormat);

  const isDraggable = isInsidePlugin && downloadStatus === 'cached' && cachedPath;

  const handleDragStart = useCallback((e) => {
    if (isDraggable && cachedPath) {
      const fileUrl = 'file:///' + cachedPath.replace(/\\/g, '/');
      const safeName = (name || fileName || "sound").replace(/[:/\\?*|"]/g, "_");
      const ext = fileFormat || "mp3";
      const fullFileName = safeName.endsWith("." + ext) ? safeName : `${safeName}.${ext}`;
      const downloadUrlData = `audio/mpeg:${fullFileName}:${fileUrl}`;
      const cleanPath = cachedPath.replace(/\\/g, '/');
      
      e.dataTransfer.setData("DownloadURL", downloadUrlData);
      e.dataTransfer.setData("text/plain", cachedPath);
      e.dataTransfer.setData("com.adobe.cep.dnd.file.0", cleanPath);
      e.dataTransfer.effectAllowed = "copy";

      // Create a premium custom drag image matching Premiere timeline clip style (green for audio)
      if (typeof document !== 'undefined') {
        const dragImage = document.createElement("div");
        dragImage.style.position = "fixed";
        dragImage.style.top = "0px";
        dragImage.style.left = "0px";
        dragImage.style.zIndex = "-9999";
        dragImage.style.padding = "4px 8px";
        dragImage.style.background = "#1e7855";
        dragImage.style.color = "#FFFFFF";
        dragImage.style.border = "1px solid #145e42";
        dragImage.style.borderRadius = "2px";
        dragImage.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        dragImage.style.fontSize = "11px";
        dragImage.style.fontWeight = "500";
        dragImage.style.pointerEvents = "none";
        dragImage.style.whiteSpace = "nowrap";
        dragImage.style.display = "flex";
        dragImage.style.alignItems = "center";
        dragImage.style.gap = "4px";
        dragImage.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
        
        dragImage.innerHTML = `<span>🔊</span> <span>${fullFileName}</span>`;
        
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 20, 12);
        
        setTimeout(() => {
          if (document.body.contains(dragImage)) {
            document.body.removeChild(dragImage);
          }
        }, 0);
      }
    }
  }, [isDraggable, cachedPath, name, fileName, fileFormat]);
  
  const { user, session, isPremium: userIsPremium, isAdmin, loading } = useAuth();
  const { isFavorited, toggleFavorite } = useFavorites();
  const isFav = isFavorited(id);

  const handleFavoriteClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(id, categoryId);
  }, [id, categoryId, toggleFavorite]);

  const router = useRouter();

  const audioRef = useRef(null);
  const rafRef = useRef(null);
  const wasPlayingRef = useRef(false);

  const resourceObj = { id, name, fileName, fileFormat, downloadUrl, ...otherProps };
  const hasPreview = isVideoFormat(resourceObj) || isImageFormat(resourceObj) || isFontFormat(resourceObj);

  const handlePreview = (e) => {
    e.stopPropagation();
    if (onPreview) onPreview(resourceObj);
  };

  // Update time via requestAnimationFrame for smooth progress
  const updateTime = useCallback(() => {
    const audio = mediaManager.getSharedAudio();
    if (audio && !audio.paused && !isScrubbing && mediaManager.isIdActive(id)) {
      setCurrentTime(audio.currentTime);
      rafRef.current = requestAnimationFrame(updateTime);
    }
  }, [isScrubbing, id]);

  // Helper to initialize audio on demand (now using Shared Singleton / Ping-pong Buffer)
  const initAudio = useCallback(() => {
    if (!downloadUrl || typeof window === 'undefined') return null;
    
    // Use Preloaded Audio if available
    const audio = typeof mediaManager.getPreloadedAudio === 'function'
      ? mediaManager.getPreloadedAudio(id)
      : mediaManager.getSharedAudio();
      
    if (!audio) return null;

    // Normalize absolute URL
    let normalizedUrl = downloadUrl;
    try {
      normalizedUrl = new URL(downloadUrl, window.location.origin).href;
    } catch (e) {}

    const currentSrc = audio.src ? new URL(audio.src, window.location.href).href : "";
    const targetSrc = normalizedUrl ? new URL(normalizedUrl, window.location.href).href : "";

    if (currentSrc !== targetSrc && !mediaManager.isIdActive(id)) {
      audio.src = normalizedUrl;
      audio.load();
    }
    
    audioRef.current = audio;
    return audio;
  }, [downloadUrl, id]);

  // Sync volume settings and handle global reset
  useEffect(() => {
    let attachedAudio = null;
    
    const handleTimeUpdate = () => {
      if (mediaManager.isIdActive(id)) {
        const audio = mediaManager.getSharedAudio();
        setCurrentTime(audio.currentTime);
      }
    };
    
    const handleDurationChange = () => {
      if (mediaManager.isIdActive(id)) {
        const audio = mediaManager.getSharedAudio();
        setDuration(audio.duration);
        
        // Apply pending seek if metadata loaded
        if (pendingSeekRatioRef.current !== null && audio.duration > 0) {
          audio.currentTime = pendingSeekRatioRef.current * audio.duration;
          setCurrentTime(audio.currentTime);
          pendingSeekRatioRef.current = null;
        }
      }
    };
    
    const handleEnded = () => {
      if (mediaManager.isIdActive(id)) {
        setIsPlaying(false);
        setCurrentTime(0);
        const audio = mediaManager.getSharedAudio();
        mediaManager.stop(audio);
      }
    };

    const unsubscribe = mediaManager.subscribe(({ activeMediaId }) => {
      const audio = mediaManager.getSharedAudio();
      
      if (activeMediaId === id) {
        setIsPlaying(!audio.paused);
        
        // Detach listeners from previously attached element if changed
        if (attachedAudio && attachedAudio !== audio) {
          attachedAudio.removeEventListener('timeupdate', handleTimeUpdate);
          attachedAudio.removeEventListener('durationchange', handleDurationChange);
          attachedAudio.removeEventListener('ended', handleEnded);
        }
        
        // Attach listeners when we become active
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('durationchange', handleDurationChange);
        audio.addEventListener('ended', handleEnded);
        attachedAudio = audio;
      } else {
        // Detach and reset when someone else becomes active
        if (isPlaying || currentTime > 0) {
          setIsPlaying(false);
          setCurrentTime(0);
        }
        if (attachedAudio) {
          attachedAudio.removeEventListener('timeupdate', handleTimeUpdate);
          attachedAudio.removeEventListener('durationchange', handleDurationChange);
          attachedAudio.removeEventListener('ended', handleEnded);
          attachedAudio = null;
        }
      }
    });

    // Initial check for handover
    if (mediaManager.isIdActive(id)) {
      const audio = mediaManager.getSharedAudio();
      setIsPlaying(!audio.paused);
      setDuration(audio.duration);
      setCurrentTime(audio.currentTime);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('durationchange', handleDurationChange);
      audio.addEventListener('ended', handleEnded);
      attachedAudio = audio;
    }

    return () => {
      unsubscribe();
      if (attachedAudio) {
        attachedAudio.removeEventListener('timeupdate', handleTimeUpdate);
        attachedAudio.removeEventListener('durationchange', handleDurationChange);
        attachedAudio.removeEventListener('ended', handleEnded);
      }
    };
  }, [id, isPlaying, currentTime]);

  // Reset state when ID changes or on unmount
  useEffect(() => {
    const cleanup = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (preloadTimeoutRef.current) clearTimeout(preloadTimeoutRef.current);
    };

    return cleanup;
  }, [id]);

  const preloadTimeoutRef = useRef(null);

  // Cancel hover immediately when scrolling starts
  useEffect(() => {
    if (isScrolling) {
      setIsHovered(false);
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
        preloadTimeoutRef.current = null;
      }
    }
  }, [isScrolling]);

  const handleMouseEnter = useCallback(() => {
    if (isScrolling) return;
    setIsHovered(true);
    
    // Debounce preloading to prevent network congestion during fast scrolling
    if (preloadTimeoutRef.current) clearTimeout(preloadTimeoutRef.current);
    
    preloadTimeoutRef.current = setTimeout(() => {
      if (typeof mediaManager.preload === 'function' && downloadUrl) {
        mediaManager.preload(id, downloadUrl);
      } else {
        // Fallback: If ANY item is already playing globally, don't interrupt it for a hover preload
        const activeId = typeof mediaManager.getActiveId === 'function' ? mediaManager.getActiveId() : null;
        if (activeId) return;

        const audio = mediaManager.getSharedAudio();
        if (audio) {
          const normalizedUrl = downloadUrl?.startsWith('http') ? downloadUrl : downloadUrl;
          // Only set src if it's different to avoid interrupting buffer
          const currentSrc = audio.src ? new URL(audio.src, window.location.href).href : "";
          const targetSrc = normalizedUrl ? new URL(normalizedUrl, window.location.href).href : "";
          
          if (currentSrc !== targetSrc) {
            audio.src = normalizedUrl;
            audio.load();
          }
        }
      }
    }, 200);
  }, [downloadUrl, id, isScrolling]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
      preloadTimeoutRef.current = null;
    }
  }, []);

  const stopPlaybackCallback = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const togglePlay = useCallback(() => {
    const canPlay = isAudioFormat(resourceObj);
    if (!canPlay) {
      console.warn("Attempted to play non-audio format:", fileFormat);
      return;
    }

    const audio = initAudio();
    if (!audio || !downloadUrl) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      mediaManager.stop(audio);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    } else {
      if (audio.ended) audio.currentTime = 0;
      mediaManager.play(audio, 'audio', stopPlaybackCallback, id);
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsPlaying(true);
          rafRef.current = requestAnimationFrame(updateTime);
        }).catch((err) => {
          if (err.name === "AbortError") return;
          console.error("Playback error:", err);
          setIsPlaying(false);
          mediaManager.stop(audio);
        });
      }
    }
  }, [downloadUrl, isPlaying, updateTime, initAudio, stopPlaybackCallback]);

  // Global seek logic using clientX for accuracy
  const seek = useCallback((clientX, target) => {
    const audio = mediaManager.getSharedAudio();
    if (!audio || !mediaManager.isIdActive(id)) return;
    
    // Use native duration as priority, fallback to state
    const audioDuration = (audio.duration && !isNaN(audio.duration) && audio.duration > 0) 
      ? audio.duration 
      : duration;

    const rect = target.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, offsetX / rect.width));

    // If we still don't have duration, store pending seek
    if (!audioDuration || isNaN(audioDuration) || audioDuration === 0) {
      pendingSeekRatioRef.current = ratio;
      return;
    }

    pendingSeekRatioRef.current = null;
    const newTime = ratio * audioDuration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration, id]);

  const handleMouseDown = useCallback((e) => {
    e.stopPropagation();
    const audio = initAudio();
    if (!audio) return;

    // Register active media immediately so seek() check passes
    mediaManager.play(audio, 'audio', stopPlaybackCallback, id);

    // Pause while scrubbing
    const isCurrentlyPlaying = !audio.paused;
    wasPlayingRef.current = true; // Always start/resume playback after seeking (fast preview)
    
    if (isCurrentlyPlaying) {
      audio.close && audio.close(); // optional cleanup
      audio.pause();
      setIsPlaying(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }

    setIsScrubbing(true);
    seek(e.clientX, e.currentTarget);
  }, [seek, initAudio, stopPlaybackCallback, id]);

  const handleTouchStart = useCallback((e) => {
    e.stopPropagation();
    const audio = initAudio();
    if (!audio) return;

    // Register active media immediately so seek() check passes
    mediaManager.play(audio, 'audio', stopPlaybackCallback, id);

    const isCurrentlyPlaying = !audio.paused;
    wasPlayingRef.current = true; // Always start/resume playback after seeking (fast preview)
    
    if (isCurrentlyPlaying) {
      audio.pause();
      setIsPlaying(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }

    setIsScrubbing(true);
    if (e.touches && e.touches.length > 0) {
      seek(e.touches[0].clientX, e.currentTarget);
    }
  }, [seek, initAudio, stopPlaybackCallback, id]);

  // Handle global scrubbing events
  useEffect(() => {
    if (!isScrubbing) return;

    const handleMouseMove = (e) => {
      const wrapper = document.querySelector(`#sound-${id} .${styles.progressWrapper}`);
      if (wrapper) seek(e.clientX, wrapper);
    };

    const handleTouchMove = (e) => {
      if (e.touches && e.touches.length > 0) {
        const wrapper = document.querySelector(`#sound-${id} .${styles.progressWrapper}`);
        if (wrapper) seek(e.touches[0].clientX, wrapper);
      }
    };

    const handleMouseUp = () => {
      setIsScrubbing(false);
      
      const audio = audioRef.current;
      if (audio && wasPlayingRef.current) {
        mediaManager.play(audio, 'audio', () => {
          setIsPlaying(false);
          setCurrentTime(0);
        }, id);
        audio.play().then(() => {
          setIsPlaying(true);
          if (!rafRef.current) rafRef.current = requestAnimationFrame(updateTime);
        }).catch(() => {});
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isScrubbing, id, seek, updateTime]);

  const handleDownload = async (e) => {
    e.stopPropagation();

    if (loading) {
      alert("Still checking your account... please wait a second.");
      return;
    }

    // Premium check
    if (!isAdmin && !userIsPremium) {
      if (isInsidePlugin) {
        if (!user) {
          window.dispatchEvent(new CustomEvent("need-auth"));
        } else {
          window.dispatchEvent(new CustomEvent("need-premium"));
        }
        return;
      } else {
        // Redirect free users to the 5s Gateway
        window.open(`/gateway/${id}`, "_blank");
        return;
      }
    }

    console.log("Starting asset download for Premiere:", id);
    // 0. If already cached in plugin, just import immediately
    if (isInsidePlugin && downloadStatus === 'cached') {
      importAsset();
      return;
    }

    if (isDownloading) return;

    setIsDownloading(true);
    try {
      // Check for session explicitly
      if (!session?.access_token) {
        console.error("No access token found in session:", session);
        alert("Your session has expired. Please sign out and sign in again.");
        return;
      }

      // 1. Call our API to increment count and get a Secure Signed Download URL
      const headers = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      };

      const response = await fetch('/api/download', {
        method: 'POST',
        headers,
        body: JSON.stringify({ resourceId: id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.requiresPremium) {
          window.dispatchEvent(new CustomEvent("need-premium"));
          throw new Error("Premium required");
        }
        throw new Error(errorData.error || "Download failed");
      }

      const { downloadUrl: signedUrl } = await response.json();
      
      if (!signedUrl) throw new Error("No download URL returned");

      if (isInsidePlugin) {
        // 2. Integration with Premiere Plugin: Send URL for the Panel to download and import
        downloadResource(signedUrl);
      } else {
        // 2. Trigger Native Browser Download
        window.location.href = signedUrl;
      }
      // 4. Cleanup UI state
      setIsDownloading(false);
    } catch (error) {
      console.error("Download failed:", error);
      setIsDownloading(false);
      alert(error.message || "Failed to download asset.");
    }
  };

  const displayName = (name || fileName || "Untitled").replace(/\.[^/.]+$/, "");
  const sizeStr = formatSize(fileSize);
  const progress = duration > 0 
    ? (currentTime / duration) * 100 
    : (pendingSeekRatioRef.current !== null ? pendingSeekRatioRef.current * 100 : 0);

  return (
    <div
      className={`${styles.item} ${isPlaying ? styles.playing : ""} ${isHighlighted ? styles.highlightFlash : ""} ${isDraggable ? styles.draggableItem : ""}`}
      style={{ "--stagger-index": index, "--cat-color": primaryColor }}
      id={`sound-${id}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      draggable={isDraggable ? "true" : undefined}
      onDragStart={isDraggable ? handleDragStart : undefined}
    >
      {/* Play button */}
      <button
        className={styles.playBtn}
        onClick={togglePlay}
        aria-label={isPlaying ? `Pause ${displayName}` : `Play ${displayName}`}
        disabled={!downloadUrl}
        style={{ '--cat-color': primaryColor }}
      >
        <span className={styles.ring} style={{ borderColor: (isPlaying || currentTime > 0) ? primaryColor : undefined }} />
        {isPlaying ? (
          <span className={styles.pauseIcon}>
            <span className={styles.pauseBar} style={{ backgroundColor: primaryColor }} />
            <span className={styles.pauseBar} style={{ backgroundColor: primaryColor }} />
          </span>
        ) : (
          <span 
            className={styles.playIcon} 
            style={{ borderLeftColor: (isPlaying || currentTime > 0) ? primaryColor : undefined }} 
          />
        )}
      </button>

      {/* Sound wave bars - Always rendered, CSS handles width/opacity animation */}
      <div className={styles.waveBars}>
        <span className={styles.bar} style={{ backgroundColor: primaryColor }} />
        <span className={styles.bar} style={{ backgroundColor: primaryColor }} />
        <span className={styles.bar} style={{ backgroundColor: primaryColor }} />
        <span className={styles.bar} style={{ backgroundColor: primaryColor }} />
      </div>

      {/* Info */}
      <div 
        className={styles.info} 
        onClick={(e) => {
          if (onPreview) {
            e.stopPropagation();
            onPreview(resourceObj);
          }
        }}
        style={{ cursor: onPreview ? 'pointer' : 'default' }}
      >
        <span className={styles.name} title={name} style={{ color: isPlaying ? primaryColor : 'inherit' }}>{displayName}</span>
        <div className={styles.meta}>
          {fileFormat && <span className={styles.format}>{fileFormat}</span>}
          {sizeStr && <span className={styles.size}>{sizeStr}</span>}
          <span className={styles.dlCount}>
            <Download size={10} />
            {(downloadCount || 0).toLocaleString()}
          </span>
          {/* Time display container handles jumpy layout */}
          <span 
            className={`${styles.time} ${(isPlaying || currentTime > 0) ? styles.timeVisible : ""}`}
            style={{ color: isPlaying ? primaryColor : 'inherit' }}
          >
            {duration > 0 ? `${formatTime(currentTime)} / ${formatTime(duration)}` : ""}
          </span>
        </div>
      </div>

      {/* Stable Progress bar structure */}
      <div 
        className={`${styles.progressWrapper} ${(isPlaying || currentTime > 0 || isScrubbing || isHovered) ? styles.timeVisible : ""}`} 
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        data-scrubbing={isScrubbing}
        style={{ 
          opacity: (isPlaying || currentTime > 0 || isScrubbing || isHovered) ? 1 : 0, 
          visibility: (isPlaying || currentTime > 0 || isScrubbing || isHovered) ? 'visible' : 'hidden',
          height: isScrubbing ? '6px' : undefined
        }}
      >
        <div className={styles.progressTrack}>
          <div 
            className={styles.progressFill} 
            style={{ width: `${progress}%`, backgroundColor: primaryColor }} 
          />
        </div>
      </div>

      {similarity && (
        <div className={styles.similarityBadge}>
          {Math.round(similarity * 100)}% MATCH
        </div>
      )}

      {/* Star button */}
      <button
        type="button"
        className={`${styles.favoriteBtn} ${isFav ? styles.active : ""}`}
        onClick={handleFavoriteClick}
        title={isFav ? "Remove from Favorites" : "Add to Favorites"}
        aria-label={isFav ? "Remove from Favorites" : "Add to Favorites"}
      >
        <Star size={14} fill={isFav ? "#FFD93D" : "none"} />
      </button>

      {/* Detail Page Link */}
      {!isPlugin && !isInsidePlugin && onPreview && (
        <button
          className={styles.previewBtn}
          onClick={(e) => {
            e.stopPropagation();
            if (onPreview) onPreview(resourceObj);
          }}
          title="View details"
          aria-label={`View details for ${displayName}`}
        >
          <Eye size={16} />
        </button>
      )}

      <button
        className={styles.downloadBtn}
        onClick={handleDownload}
        disabled={isDownloading || !downloadUrl || (isInsidePlugin && downloadStatus === 'downloading')}
        aria-label={`${isPlugin ? 'Import' : 'Download'} ${displayName}`}
      >
        {isInsidePlugin ? (
          <div key={downloadStatus}>
            {downloadStatus === 'downloading' ? (
              <Loader2 size={14} className="animate-spin" color="white" />
            ) : downloadStatus === 'cached' ? (
              <Plus size={16} color="white" />
            ) : (
              <Download size={16} color="white" />
            )}
          </div>
        ) : (
          isDownloading ? <Loader2 size={14} className="animate-spin" color="white" /> : <Download size={14} color="white" />
        )}
      </button>
    </div>
  );
});

export default SoundButton;
