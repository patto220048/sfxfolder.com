"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye } from "lucide-react";
import { useAuth } from "@/app/lib/auth-context";
import { incrementDownloadCount } from "@/app/lib/api";
import { mediaManager } from "@/app/lib/mediaManager";
import { isVideoFormat, isImageFormat, isFontFormat, isAudioFormat } from "@/app/lib/mediaUtils";
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

export default function SoundButton({
  id,
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
  ...otherProps
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const { user, isPremium: userIsPremium, isAdmin } = useAuth();
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
    const audio = audioRef.current;
    if (audio && !audio.paused && !isScrubbing) {
      setCurrentTime(audio.currentTime);
      rafRef.current = requestAnimationFrame(updateTime);
    }
  }, [isScrubbing]);

  // Helper to initialize audio on demand
  const initAudio = useCallback(() => {
    if (!downloadUrl) return null;
    
    // Normalize absolute URL for comparison and source assignment
    let normalizedUrl = downloadUrl;
    if (typeof window !== 'undefined') {
      try {
        normalizedUrl = new URL(downloadUrl, window.location.origin).href;
      } catch (e) {
        console.warn("URL normalization failed:", downloadUrl);
      }
    }
    
    // If audio object already exists but URL is different, update its src
    if (audioRef.current) {
      const currentSrc = audioRef.current.src;

      if (currentSrc !== normalizedUrl && normalizedUrl) {
        audioRef.current.pause();
        audioRef.current.src = normalizedUrl;
        audioRef.current.load();
      }
      
      // Sync duration if already available
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
      return audioRef.current;
    }
    
    const audio = new Audio();
    
    // NOTE: Removed crossOrigin="anonymous" because it requires strict server configuration.
    // Standard public URLs in Supabase are more compatible with default "opaque" loading.
    audio.preload = "metadata";
    audio.src = normalizedUrl;

    audio.addEventListener("loadedmetadata", () => {
      if (audioRef.current === audio) {
        setDuration(audio.duration);
      }
    });
    
    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      setCurrentTime(0);
      mediaManager.stop(audio);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    });
    
    audio.addEventListener("error", (e) => {
      const error = audio.error;
      let msg = "Unknown error";
      if (error) {
        switch (error.code) {
          case 1: msg = "Aborted"; break;
          case 2: msg = "Network error"; break;
          case 3: msg = "Decoding error"; break;
          case 4: msg = "Format not supported or Access Denied"; break;
        }
      }
      
      // Don't log error if src was programmatically cleared during cleanup
      if (audio.src === "" || audio.src === window.location.href) return;

      console.error(`Playback element error [${msg}]:`, normalizedUrl, {
        code: error?.code,
        message: error?.message,
        url: normalizedUrl,
        readyState: audio.readyState
      });
      setIsPlaying(false);
      mediaManager.stop(audio);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    });
    
    audioRef.current = audio;
    return audio;
  }, [downloadUrl, id]);

  // Sync volume settings and handle global reset
  useEffect(() => {
    return mediaManager.subscribe(({ activeMediaId }) => {
      // If another item started playing, and we are not that item, but we have progress
      if (activeMediaId && activeMediaId !== id) {
        if (isPlaying || currentTime > 0) {
          setIsPlaying(false);
          setCurrentTime(0);
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          
          // Actually stop the audio if it was the one playing
          if (audioRef.current && !audioRef.current.paused) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
        }
      }
    });
  }, [id, isPlaying, currentTime]);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        mediaManager.stop(audio);
        audio.src = "";
        audioRef.current = null;
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    const audio = initAudio();
    if (audio && audio.readyState < 2 && audio.paused) {
      audio.preload = "auto";
      audio.load();
    }
  }, [initAudio]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
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
      mediaManager.play(audio, 'audio', () => {
        setIsPlaying(false);
        setCurrentTime(0); // Sync state when another media overrides
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      }, id);
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
  }, [downloadUrl, isPlaying, updateTime, initAudio]);

  // Global seek logic using clientX for accuracy
  const seek = useCallback((clientX, target) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    // Use native duration as priority, fallback to state
    const audioDuration = (audio.duration && !isNaN(audio.duration) && audio.duration > 0) 
      ? audio.duration 
      : duration;

    // If we still don't have duration, we can't seek
    if (!audioDuration || isNaN(audioDuration) || audioDuration === 0) {
      return;
    }

    const rect = target.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, offsetX / rect.width));
    
    const newTime = ratio * audioDuration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration, id, isScrubbing]);

  const handleMouseDown = useCallback((e) => {
    e.stopPropagation();
    const audio = initAudio();
    if (!audio) return;

    // YouTube style: Pause while scrubbing, remember if it was playing
    const isCurrentlyPlaying = !audio.paused;
    wasPlayingRef.current = isCurrentlyPlaying;
    
    if (isCurrentlyPlaying) {
      audio.pause();
      setIsPlaying(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }

    setIsScrubbing(true);
    // Use a small timeout or immediate update to ensure state is processed if needed
    // but clientX is already available
    seek(e.clientX, e.currentTarget);
  }, [seek, initAudio]);

  // Handle global scrubbing events
  useEffect(() => {
    if (!isScrubbing) return;

    const handleMouseMove = (e) => {
      const wrapper = document.querySelector(`#sound-${id} .${styles.progressWrapper}`);
      if (wrapper) seek(e.clientX, wrapper);
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
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isScrubbing, id, seek, updateTime]);

  const handleDownload = async (e) => {
    e.stopPropagation();

    // Premium check - All resources now require Premium
    if (!isAdmin && !userIsPremium) {
      window.dispatchEvent(new CustomEvent("need-premium"));
      return;
    }

    if (isDownloading) return;

    setIsDownloading(true);
    try {
      // 1. Call our API to increment count and get a Secure Signed Download URL
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      // 2. Trigger Native Browser Download via Hidden Anchor
      const link = document.createElement('a');
      link.href = signedUrl;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);
    } catch (err) {
      console.error("Download failed:", err);
    }
    setIsDownloading(false);
  };

  const displayName = (name || fileName || "Untitled").replace(/\.[^/.]+$/, "");
  const sizeStr = formatSize(fileSize);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`${styles.item} ${isPlaying ? styles.playing : ""}`}
      style={{ "--stagger-index": index }}
      id={`sound-${id}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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

        {/* Stable Progress bar structure */}
        <div 
          className={`${styles.progressWrapper} ${(isPlaying || currentTime > 0 || isScrubbing || isHovered) ? styles.timeVisible : ""}`} 
          onMouseDown={handleMouseDown}
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
      </div>

      {/* Detail Page Link */}
      {onPreview && (
        <button
          className={styles.previewBtn}
          onClick={onPreview}
          title="View details"
          aria-label={`View details for ${displayName}`}
        >
          <Eye size={16} />
        </button>
      )}

      {/* Download */}
      <button
        className={styles.downloadBtn}
        onClick={handleDownload}
        disabled={isDownloading || !downloadUrl}
        aria-label={`Download ${displayName}`}
      >
        <Download size={14} />
      </button>
    </div>
  );
}
