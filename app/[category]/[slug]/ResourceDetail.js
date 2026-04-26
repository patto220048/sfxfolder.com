"use client";

import { useState } from "react";
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
  Music,
} from "lucide-react";
import DownloadButton from "@/app/components/ui/DownloadButton";
import PreviewOverlay from "@/app/components/ui/PreviewOverlay";
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

export default function ResourceDetail({
  resource,
  related,
  categorySlug,
  categoryName,
  categoryColor,
}) {
  const [showPreview, setShowPreview] = useState(false);

  const displayName = (resource.name || "Untitled").replace(/\.[^/.]+$/, "");
  const isVideo = isVideoFormat(resource);
  const isImage = isImageFormat(resource);
  const isAudio = isAudioFormat(resource);
  const isFont = isFontFormat(resource);

  const resolvedUrl = resource.downloadUrl || resource.fileUrl;

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
        {/* Preview Area */}
        <div className={styles.previewSection}>
          <div
            className={styles.previewBox}
            onClick={() => setShowPreview(true)}
          >
            {isVideo && (
              <>
                {resource.thumbnailUrl ? (
                  <Image
                    src={getOptimizedUrl(resource.thumbnailUrl, { width: 800 })}
                    alt={displayName}
                    fill
                    className={styles.previewImage}
                    priority
                    onError={(e) => {
                      e.target.src = resource.thumbnailUrl;
                    }}
                  />
                ) : resolvedUrl ? (
                  <video
                    src={`${resolvedUrl}#t=0.1`}
                    className={styles.previewVideo}
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : null}
                <div className={styles.playOverlay}>
                  <Play size={48} />
                </div>
              </>
            )}

            {isImage && (
              <Image
                src={getOptimizedUrl(
                  resource.previewUrl ||
                    resource.thumbnailUrl ||
                    resolvedUrl,
                  { width: 800 }
                )}
                alt={displayName}
                fill
                className={styles.previewImage}
                priority
                onError={(e) => {
                  e.target.src =
                    resource.previewUrl ||
                    resource.thumbnailUrl ||
                    resolvedUrl;
                }}
              />
            )}

            {isAudio && (
              <div className={styles.audioPreview}>
                <Music size={64} strokeWidth={1} />
                <span className={styles.audioLabel}>Click to preview</span>
              </div>
            )}

            {isFont && (
              <div className={styles.fontPreview}>
                <p className={styles.fontSampleLg}>Aa Bb Cc Dd</p>
                <p className={styles.fontSampleSm}>
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
            )}

            {!isVideo && !isImage && !isAudio && !isFont && (
              <div className={styles.genericPreview}>
                <FileText size={48} strokeWidth={1} />
                <span>{resource.fileFormat?.toUpperCase()}</span>
              </div>
            )}

            <div className={styles.formatBadge}>
              {resource.fileFormat?.toUpperCase()}
            </div>
          </div>
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

      {/* Preview Overlay */}
      {showPreview && (
        <PreviewOverlay
          resource={resource}
          onClose={() => setShowPreview(false)}
          showDownload={true}
        />
      )}
    </div>
  );
}
