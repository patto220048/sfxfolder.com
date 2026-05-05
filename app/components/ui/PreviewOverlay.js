"use client";

import { useEffect, useRef, useState } from "react";
import { X, Music, Download, Plus, Loader2 } from "lucide-react";
import { mediaManager } from "@/app/lib/mediaManager";
import { usePluginCache } from "@/app/hooks/usePluginCache";
import dynamic from "next/dynamic";
const LUTPreview = dynamic(() => import("./LUTPreview"), {
  loading: () => <div style={{ height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', borderRadius: '12px' }}>Loading Preview...</div>,
  ssr: false
});
import { isVideoFormat, isImageFormat, isFontFormat, isAudioFormat, isLUTFormat, getOptimizedUrl } from "@/app/lib/mediaUtils";
import { useAuth } from "@/app/lib/auth-context";
import DownloadButton from "./DownloadButton";
import styles from "./PreviewOverlay.module.css";

export default function PreviewOverlay({ resource, onClose, showDownload = false, isPlugin = false }) {
  const mediaRef = useRef(null);
  const [isHovering, setIsHovering] = useState(false);
  const { user, session, isPremium, isAdmin } = useAuth();
  const { 
    downloadStatus, 
    progress: pluginProgress, 
    isInsidePlugin, 
    importAsset,
    downloadResource 
  } = usePluginCache(resource?.id, resource?.fileName, resource?.fileFormat);

  useEffect(() => {
    console.log("PreviewOverlay mounted:", { 
      resourceName: resource?.name, 
      resourceId: resource?.id, 
      isPlugin 
    });
    // Attempt to log to parent
    try {
      if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({ 
          type: 'DEBUG_LOG', 
          message: 'PreviewOverlay mounted. isPlugin: ' + isPlugin 
        }, '*');
      }
    } catch (e) {}
  }, [resource, isPlugin]);

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Sync with mediaManager
  useEffect(() => {
    if (!resource) return;
    
    if (isVideoFormat(resource) && mediaRef.current) {
      mediaManager.play(mediaRef.current, 'video');
      // Click interaction already happened to open this overlay, so unmuted auto-play should work
      mediaRef.current.play().catch(err => console.log("Auto-play blocked:", err));
    } else if (isAudioFormat(resource)) {
      const audio = mediaManager.getSharedAudio();
      
      const handleTimeUpdate = () => {
        if (mediaManager.isIdActive(resource.id)) {
          setCurrentTime(audio.currentTime);
        }
      };
      const handleDurationChange = () => {
        if (mediaManager.isIdActive(resource.id)) {
          setDuration(audio.duration);
        }
      };
      const handleEnded = () => {
        if (mediaManager.isIdActive(resource.id)) {
          setIsPlaying(false);
          mediaManager.stop(audio);
        }
      };

      const unsubscribe = mediaManager.subscribe(({ activeMediaId }) => {
        if (activeMediaId === resource.id) {
          setIsPlaying(!audio.paused);
          setDuration(audio.duration);
          setCurrentTime(audio.currentTime);
          
          audio.addEventListener('timeupdate', handleTimeUpdate);
          audio.addEventListener('durationchange', handleDurationChange);
          audio.addEventListener('ended', handleEnded);
        } else {
          setIsPlaying(false);
          audio.removeEventListener('timeupdate', handleTimeUpdate);
          audio.removeEventListener('durationchange', handleDurationChange);
          audio.removeEventListener('ended', handleEnded);
        }
      });

      // Handover check
      if (mediaManager.isIdActive(resource.id)) {
        setIsPlaying(!audio.paused);
        setDuration(audio.duration);
        setCurrentTime(audio.currentTime);
      } else {
        // Start playing if it's a preview
        const url = resource.downloadUrl || resource.fileUrl;
        if (url) {
          mediaManager.play(audio, 'audio', () => setIsPlaying(false), resource.id);
          audio.src = url;
          audio.load();
          audio.play().catch(() => {});
          setIsPlaying(true);
        }
      }

      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('durationchange', handleDurationChange);
      audio.addEventListener('ended', handleEnded);

      return () => {
        unsubscribe();
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('durationchange', handleDurationChange);
        audio.removeEventListener('ended', handleEnded);
      };
    }
  }, [resource]);

  const toggleAudio = () => {
    const audio = mediaManager.getSharedAudio();
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  };

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

  const isVideo = isVideoFormat(resource);
  const isImage = isImageFormat(resource);
  const isFont = isFontFormat(resource);
  const isAudio = isAudioFormat(resource);
  const isLUT = isLUTFormat(resource);

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
          {isVideo && (
            <video 
              ref={mediaRef}
              src={getOptimizedUrl(resource)} 
              poster={getOptimizedUrl(resource.thumbnailUrl || resource.previewUrl, { width: 1200 })}
              controls 
              autoPlay
              loop
              playsInline 
              preload="auto"
              className={styles.largePreviewVideo} 
            />
          )}
          {isImage && (
            <img 
              src={getOptimizedUrl(resource, { width: 1200, quality: 85 })} 
              alt={resource.name} 
              className={styles.largePreviewImage} 
              onError={(e) => {
                e.target.src = resource.downloadUrl || resource.fileUrl;
              }}
            />
          )}
          {isFont && (
            <div className={styles.largePreviewFont}>
               <p>ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
               <p>abcdefghijklmnopqrstuvwxyz</p>
               <p>0123456789</p>
               <p style={{ fontSize: '2.5rem', marginTop: '20px' }}>
                 The quick brown fox jumps over the lazy dog
               </p>
            </div>
          )}
          {isAudio && (
            <div className={styles.largePreviewAudio}>
              <div className={styles.audioPlayerUI} onClick={toggleAudio}>
                <div className={styles.audioIconWrapper}>
                  {isPlaying ? (
                    <div className={styles.playingBars}>
                      <span className={styles.bar}></span>
                      <span className={styles.bar}></span>
                      <span className={styles.bar}></span>
                    </div>
                  ) : (
                    <Music size={80} />
                  )}
                </div>
                <div className={styles.audioControls}>
                   <div className={styles.audioProgress}>
                      <div 
                        className={styles.audioProgressFill} 
                        style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} 
                      />
                   </div>
                   <div className={styles.audioTime}>
                      {duration > 0 && `${Math.floor(currentTime)}s / ${Math.floor(duration)}s`}
                   </div>
                </div>
              </div>
            </div>
          )}
          
          {isLUT && (
            <LUTPreview 
              lutUrl={resource.downloadUrl || resource.fileUrl} 
              referenceImageUrl={resource.thumbnailUrl || resource.category?.reference_image_url} 
              name={resource.name}
            />
          )}
          
          {/* Default fallback if format not supported */}
          {!isVideo && !isImage && !isFont && !isAudio && !isLUT && (
            <div className={styles.largePreviewFont}>
              <p>Preview not available for this format</p>
              <p style={{ fontSize: '1rem', opacity: 0.7 }}>{resource.fileName || resource.name} ({resource.fileFormat || "unknown"})</p>
            </div>
          )}
        </div>
        
        <div className={styles.previewInfo}>
          <div className={styles.previewHeader}>
            <h2>{resource.name || resource.fileName || "Untitled"}</h2>
            {showDownload && (
              <div className={styles.previewDownload}>
                {isPlugin && (
                  <button 
                    className={styles.insertBtn}
                    disabled={isInserting}
                    onClick={async (e) => {
                      console.log("INSERT ATTEMPT STARTED");
                      try {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Try logging to parent safely
                        try {
                          if (window.parent && window.parent.postMessage) {
                            window.parent.postMessage({ type: 'DEBUG_LOG', message: 'Insert button clicked inside iframe' }, '*');
                          }
                        } catch (e) {}

                        // If already cached in plugin, just import immediately
                        if (isInsidePlugin && downloadStatus === 'cached') {
                          importAsset();
                          return;
                        }

                        if (isInserting) return;

                        // Check auth
                        if (!isAdmin && !isPremium) {
                          alert("Please login with a Premium account to insert assets into Premiere.");
                          return;
                        }
                        
                        setIsInserting(true);
                        
                        if (!session?.access_token) {
                          alert("Your session has expired. Please sign out and sign in again.");
                          return;
                        }

                        // 1. Fetch secure signed URL from API
                        console.log("Calling /api/download for resource:", resource.id);
                        const headers = { 
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${session.access_token}`
                        };

                        const response = await fetch('/api/download', {
                          method: 'POST',
                          headers,
                          body: JSON.stringify({ resourceId: resource.id }),
                        });

                        if (!response.ok) {
                          const errorData = await response.json();
                          throw new Error(errorData.error || "Failed to get download URL");
                        }

                        const { downloadUrl: signedUrl } = await response.json();
                        
                        if (!signedUrl) throw new Error("No download URL returned");

                        const fileName = resource.name || resource.fileName || "asset";
                        const extension = resource.fileFormat || signedUrl.split('.').pop().split('?')[0] || "mp4";
                        const fullFileName = fileName.endsWith(`.${extension}`) ? fileName : `${fileName}.${extension}`;

                        console.log("Inserting to Premiere with secure URL:", fullFileName);
                        
                        // 2. Send to Premiere Panel
                        if (window.parent !== window) {
                          downloadResource(signedUrl);
                        } else {
                          alert("Insert only works inside Adobe Premiere Pro");
                        }
                      } catch (err) {
                        console.error("Insert failed:", err);
                        alert(err.message || "Failed to insert asset");
                      } finally {
                        setIsInserting(false);
                      }
                    }}
                  >
                    {isInserting ? (
                      <div className="flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        <span>PREPARING...</span>
                      </div>
                    ) : (
                      isPlugin && (
                        <>
                          {downloadStatus === 'downloading' ? (
                            <div className="flex items-center gap-2">
                              <Loader2 size={16} className="animate-spin" />
                              <span>DOWNLOADING...</span>
                            </div>
                          ) : downloadStatus === 'cached' ? (
                            <div className="flex items-center gap-2" style={{ color: 'white' }}>
                              <Plus size={18} />
                              <span>ADD TO TIMELINE</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2" style={{ color: 'white' }}>
                              <Download size={18} />
                              <span>DOWNLOAD ASSET</span>
                            </div>
                          )}
                        </>
                      )
                    )}
                  </button>
                )}
                {!isPlugin && (
                  <DownloadButton 
                    downloadUrl={resource.downloadUrl} 
                    fileUrl={resource.fileUrl}
                    fileName={resource.name || resource.fileName}
                    fileFormat={resource.fileFormat}
                    resourceId={resource.id}
                    size="compact"
                    isPlugin={isPlugin}
                  />
                )}
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
