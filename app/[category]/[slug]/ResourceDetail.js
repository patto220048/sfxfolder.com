"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Download,
  FileText,
  Clock,
  Tag,
  Play,
  Pause,
  Music,
  Sparkles,
} from "lucide-react";
import { mediaManager } from "@/app/lib/mediaManager";
import DownloadButton from "@/app/components/ui/DownloadButton";
import ResourceCard from "@/app/components/ui/ResourceCard";
import SoundButton from "@/app/components/ui/SoundButton";
import {
  isVideoFormat,
  isImageFormat,
  isAudioFormat,
  isFontFormat,
  getOptimizedUrl,
} from "@/app/lib/mediaUtils";
import styles from "./page.module.css";

function formatSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(seconds) {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ResourceDetail({
  resource,
  related,
  categorySlug,
  categoryName,
  categoryColor,
}) {
  const router = useRouter();
  const displayName = (resource.name || "Untitled").replace(/\.[^/.]+$/, "");
  const isVideo = isVideoFormat(resource);
  const isImage = isImageFormat(resource);
  const isAudio = isAudioFormat(resource);
  const isFont = isFontFormat(resource);
  const resolvedUrl = resource.downloadUrl || resource.fileUrl;

  // Inline player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoStarted, setVideoStarted] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const rafRef = useRef(null);
  const wasPlayingRef = useRef(false);

  // Helper to initialize audio on demand
  const initAudio = useCallback(() => {
    if (!resolvedUrl) return null;
    if (!audioRef.current) {
      const audio = new Audio(resolvedUrl);
      audioRef.current = audio;
      audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        setCurrentTime(0);
        mediaManager.stop(audio);
      });
      // Initial apply volume settings
      mediaManager.applySettings(audio, 'audio');
    }
    return audioRef.current;
  }, [resolvedUrl]);

  // --- Audio inline player ---
  const toggleAudio = useCallback(() => {
    const audio = initAudio();
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setIsPlaying(false);
      mediaManager.stop(audio);
    } else {
      // Register with global media manager
      mediaManager.play(audio, 'audio', () => {
        setIsPlaying(false);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      }, resource.id);

      audio.play().catch(() => {});
      const tick = () => {
        setCurrentTime(audio.currentTime);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      setIsPlaying(true);
    }
  }, [initAudio, isPlaying, resource.id]);

  // --- Unified Seeking Logic ---
  const seek = useCallback((clientX, container) => {
    const media = isAudio ? audioRef.current : videoRef.current;
    if (!media) return;

    const rect = container.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    
    const targetDuration = media.duration || duration;
    if (targetDuration && !isNaN(targetDuration)) {
      const newTime = ratio * targetDuration;
      media.currentTime = newTime;
      setCurrentTime(newTime);
    } else if (isAudio) {
      // If audio duration not loaded yet, wait for metadata
      media.addEventListener('loadedmetadata', () => {
        const newTime = ratio * media.duration;
        media.currentTime = newTime;
        setCurrentTime(newTime);
        setDuration(media.duration);
      }, { once: true });
      media.load();
    }
  }, [isAudio, duration]);

  const handleMouseDown = useCallback((e) => {
    e.stopPropagation();
    const media = isAudio ? initAudio() : videoRef.current;
    if (!media) return;

    // YouTube style: Pause while scrubbing, remember if it was playing
    wasPlayingRef.current = !media.paused;
    
    if (!media.paused) {
      media.pause();
      setIsPlaying(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }

    setIsScrubbing(true);
    seek(e.clientX, e.currentTarget);
  }, [isAudio, initAudio, seek]);

  useEffect(() => {
    if (!isScrubbing) return;

    const handleMouseMove = (e) => {
      // Find the progress bar container
      const container = isAudio 
        ? document.querySelector(`.${styles.audioProgressBar}`)
        : document.querySelector(`.${styles.videoProgressWrapper}`);
      if (container) seek(e.clientX, container);
    };

    const handleMouseUp = (e) => {
      setIsScrubbing(false);
      const media = isAudio ? audioRef.current : videoRef.current;
      if (!media) return;

      // Resume if it was playing before
      if (wasPlayingRef.current) {
        media.play().catch(() => {});
        setIsPlaying(true);
        
        const tick = () => {
          setCurrentTime(media.currentTime);
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isScrubbing, isAudio, seek]);

  // Sync with global volume settings
  useEffect(() => {
    const unsubscribe = mediaManager.subscribe((settings) => {
      if (audioRef.current) {
        audioRef.current.volume = settings.audio.volume;
        audioRef.current.muted = settings.audio.muted;
      }
      if (videoRef.current) {
        videoRef.current.volume = settings.video.volume;
        videoRef.current.muted = settings.video.muted;
      }
    });
    
    // Initial apply
    if (audioRef.current) mediaManager.applySettings(audioRef.current, 'audio');
    if (videoRef.current) mediaManager.applySettings(videoRef.current, 'video');

    return unsubscribe;
  }, []);

  // --- Video inline player ---
  const toggleVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!videoStarted) {
      setVideoStarted(true);
      // Ensure settings are applied on first start
      mediaManager.applySettings(video, 'video');
    }
    if (video.paused) {
      // Register with global media manager
      mediaManager.play(video, 'video', () => {
        setIsPlaying(false);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      }, resource.id);

      video.play().catch(() => {});
      setIsPlaying(true);

      const tick = () => {
        setCurrentTime(video.currentTime);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      video.pause();
      setIsPlaying(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      mediaManager.stop(video);
    }
  }, [videoStarted, resource.id]);

  // Determine layout type for related cards
  const categoryLayout = isAudio
    ? "sound"
    : isVideo
    ? "video"
    : isImage
    ? "image"
    : isFont
    ? "font"
    : "video";

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={styles.page} style={{ "--cat-color": categoryColor }}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb}>
        <Link href="/" className={styles.breadcrumbLink}>
          Home
        </Link>
        <span className={styles.breadcrumbSep}>/</span>
        <Link
          href={`/${categorySlug}`}
          className={styles.breadcrumbLink}
          style={{ color: categoryColor }}
        >
          {categoryName}
        </Link>
        <span className={styles.breadcrumbSep}>/</span>
        <span className={styles.breadcrumbCurrent}>{displayName}</span>
      </nav>

      {/* Back button */}
      <Link href={`/${categorySlug}`} className={styles.backLink}>
        <ArrowLeft size={16} />
        <span>Back to {categoryName}</span>
      </Link>

      {/* Main Content */}
      <motion.div
        className={styles.content}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Preview Area — Inline Player */}
        <div className={styles.previewSection}>
          {/* === VIDEO: inline player === */}
          {isVideo && (
            <div className={styles.previewBox} onClick={toggleVideo}>
              {!videoStarted && resource.thumbnailUrl ? (
                <Image
                  src={getOptimizedUrl(resource.thumbnailUrl, { width: 800 })}
                  alt={displayName}
                  fill
                  className={styles.previewImage}
                  priority
                  onError={(e) => { e.target.src = resource.thumbnailUrl; }}
                />
              ) : null}
              <video
                ref={videoRef}
                src={resolvedUrl}
                className={styles.previewVideo}
                playsInline
                preload="metadata"
                style={{ display: videoStarted || !resource.thumbnailUrl ? "block" : "none" }}
                onLoadedMetadata={(e) => setDuration(e.target.duration)}
                onEnded={() => {
                  setIsPlaying(false);
                  if (rafRef.current) cancelAnimationFrame(rafRef.current);
                }}
              />
              <div className={`${styles.playOverlay} ${isPlaying ? styles.playOverlayHidden : ""}`}>
                {isPlaying ? <Pause size={48} /> : <Play size={48} />}
              </div>
              <div className={styles.formatBadge}>
                {resource.fileFormat?.toUpperCase()}
              </div>

              {/* Video Progress Bar */}
              {(videoStarted || !resource.thumbnailUrl) && (
                <div 
                  className={styles.videoProgressWrapper}
                  onMouseDown={handleMouseDown}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={styles.videoProgressTrack}>
                    <div 
                      className={styles.videoProgressFill} 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* === IMAGE: full view === */}
          {isImage && (
            <div className={styles.previewBox}>
              <Image
                src={getOptimizedUrl(
                  resource.previewUrl || resource.thumbnailUrl || resolvedUrl,
                  { width: 800 }
                )}
                alt={displayName}
                fill
                className={styles.previewImage}
                priority
                onError={(e) => {
                  e.target.src = resource.previewUrl || resource.thumbnailUrl || resolvedUrl;
                }}
              />
              <div className={styles.formatBadge}>
                {resource.fileFormat?.toUpperCase()}
              </div>
            </div>
          )}

          {/* === AUDIO: inline player with waveform UI === */}
          {isAudio && (
            <div className={styles.audioPlayerBox}>
              <button className={styles.audioPlayBtn} onClick={toggleAudio} style={{ "--cat-color": categoryColor }}>
                {isPlaying ? <Pause size={32} /> : <Play size={32} />}
              </button>

              <div className={styles.audioPlayerInfo}>
                <span className={styles.audioPlayerName}>{displayName}</span>
                <div className={styles.audioPlayerMeta}>
                  <span>{resource.fileFormat?.toUpperCase()}</span>
                  <span>{formatSize(resource.fileSize)}</span>
                  {duration > 0 && (
                    <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
                  )}
                </div>
                {/* Progress bar */}
                <div className={styles.audioProgressBar} onMouseDown={handleMouseDown}>
                  <div
                    className={styles.audioProgressFill}
                    style={{ width: `${progress}%`, backgroundColor: categoryColor }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* === FONT: sample preview === */}
          {isFont && (
            <div className={styles.previewBox}>
              <div className={styles.fontPreview}>
                <p className={styles.fontSampleLg}>Aa Bb Cc Dd</p>
                <p className={styles.fontSampleSm}>
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
              <div className={styles.formatBadge}>
                {resource.fileFormat?.toUpperCase()}
              </div>
            </div>
          )}

          {/* === GENERIC file === */}
          {!isVideo && !isImage && !isAudio && !isFont && (
            <div className={styles.previewBox}>
              <div className={styles.genericPreview}>
                <FileText size={48} strokeWidth={1} />
                <span>{resource.fileFormat?.toUpperCase()}</span>
              </div>
              <div className={styles.formatBadge}>
                {resource.fileFormat?.toUpperCase()}
              </div>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className={styles.infoSection}>
          <h1 className={styles.title}>{displayName}</h1>

          {resource.description && (
            <p className={styles.description}>{resource.description}</p>
          )}

          {/* Meta Grid */}
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <FileText size={14} />
              <span className={styles.metaLabel}>Format</span>
              <span className={styles.metaValue}>
                {resource.fileFormat?.toUpperCase() || "—"}
              </span>
            </div>
            <div className={styles.metaItem}>
              <Download size={14} />
              <span className={styles.metaLabel}>Size</span>
              <span className={styles.metaValue}>
                {formatSize(resource.fileSize)}
              </span>
            </div>
            <div className={styles.metaItem}>
              <Download size={14} />
              <span className={styles.metaLabel}>Downloads</span>
              <span className={styles.metaValue}>
                {(resource.downloadCount || 0).toLocaleString()}
              </span>
            </div>
            <div className={styles.metaItem}>
              <Clock size={14} />
              <span className={styles.metaLabel}>Added</span>
              <span className={styles.metaValue}>
                {formatDate(resource.createdAt)}
              </span>
            </div>
          </div>

          {/* Tags */}
          {resource.tags && resource.tags.length > 0 && (
            <div className={styles.tagsSection}>
              <div className={styles.tagsLabel}>
                <Tag size={14} />
                <span>Tags</span>
              </div>
              <div className={styles.tagsList}>
                {resource.tags.map((tag) => (
                  <span key={tag} className={styles.tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Download Action */}
          <div className={styles.downloadSection}>
            <DownloadButton
              downloadUrl={resolvedUrl}
              fileName={resource.name}
              fileFormat={resource.fileFormat}
              resourceId={resource.id}
            />
          </div>

          {/* Category Link */}
          <div className={styles.categoryLink}>
            <span>Category:</span>
            <Link
              href={`/${categorySlug}`}
              style={{ color: categoryColor }}
            >
              {categoryName}
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Related Resources */}
      {related && related.length > 0 && (
        <section className={styles.relatedSection}>
          <h2 className={styles.relatedTitle}>Related Resources</h2>
          <div
            className={
              categoryLayout === "sound"
                ? styles.relatedGridSound
                : styles.relatedGrid
            }
          >
            {related.map((res, idx) => {
              if (categoryLayout === "sound") {
                return (
                  <div key={res.id} className={styles.relatedItemSound}>
                    <SoundButton
                      {...res}
                      downloadUrl={res.downloadUrl || res.fileUrl}
                      index={idx}
                      primaryColor={categoryColor}
                      onPreview={() => router.push(`/${categorySlug}/${res.slug}`)}
                    />
                    {res.similarity && (
                      <div className={styles.soundMatchLabel}>
                        {Math.round(res.similarity * 100)}% MATCH
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <div key={res.id} className={styles.relatedCardWrapper}>
                  {res.similarity && (
                    <div className={styles.matchScore}>
                      <Sparkles size={10} />
                      {Math.round(res.similarity * 100)}% MATCH
                    </div>
                  )}
                  <ResourceCard
                    {...res}
                    categorySlug={categorySlug}
                    primaryColor={categoryColor}
                    detailUrl={`/${categorySlug}/${res.slug}`}
                    onPreview={() => router.push(`/${categorySlug}/${res.slug}`)}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
