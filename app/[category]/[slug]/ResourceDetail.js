"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
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
} from "lucide-react";
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

  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const rafRef = useRef(null);

  // --- Audio inline player ---
  const toggleAudio = useCallback(() => {
    if (!resolvedUrl) return;
    if (!audioRef.current) {
      const audio = new Audio(resolvedUrl);
      audioRef.current = audio;
      audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        setCurrentTime(0);
      });
    }
    const audio = audioRef.current;
    if (isPlaying) {
      audio.pause();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      const tick = () => {
        setCurrentTime(audio.currentTime);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      setIsPlaying(true);
    }
  }, [resolvedUrl, isPlaying]);

  const seekAudio = useCallback((e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  }, [duration]);

  // --- Video inline player ---
  const toggleVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!videoStarted) setVideoStarted(true);
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [videoStarted]);

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

  const audioProgress = duration > 0 ? (currentTime / duration) * 100 : 0;

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
                onEnded={() => setIsPlaying(false)}
              />
              <div className={`${styles.playOverlay} ${isPlaying ? styles.playOverlayHidden : ""}`}>
                {isPlaying ? <Pause size={48} /> : <Play size={48} />}
              </div>
              <div className={styles.formatBadge}>
                {resource.fileFormat?.toUpperCase()}
              </div>
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
                <div className={styles.audioProgressBar} onClick={seekAudio}>
                  <div
                    className={styles.audioProgressFill}
                    style={{ width: `${audioProgress}%`, backgroundColor: categoryColor }}
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
                  <SoundButton
                    key={res.id}
                    {...res}
                    downloadUrl={res.downloadUrl || res.fileUrl}
                    index={idx}
                    primaryColor={categoryColor}
                  />
                );
              }
              return (
                <Link
                  key={res.id}
                  href={`/${categorySlug}/${res.slug}`}
                  className={styles.relatedCardLink}
                >
                  <ResourceCard
                    {...res}
                    downloadUrl={res.downloadUrl || res.fileUrl}
                    cardType={categoryLayout}
                    index={idx}
                    primaryColor={categoryColor}
                  />
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
