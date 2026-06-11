"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Lock, X, Loader2 } from "lucide-react";
import styles from "./PackItemList.module.css";

export default function PackItemList({ items }) {
  const [playingId, setPlayingId] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  // Stop audio when component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const handlePlayToggle = async (item) => {
    if (playingId === item.id) {
      // Toggle play/pause
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
      return;
    }

    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    setLoadingId(item.id);
    setPreviewUrl(null);
    setPlayingId(null);

    try {
      const res = await fetch(`/api/shop/preview?itemId=${item.id}`);
      const data = await res.json();

      if (!res.ok || !data.previewUrl) {
        throw new Error(data.error || "Failed to fetch preview link");
      }

      setPreviewUrl(data.previewUrl);
      setPlayingId(item.id);
      setIsPlaying(true);

      // Wait for React to mount/update the audio source, then play
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.load();
          audioRef.current.play().catch((err) => {
            console.error("Audio playback error:", err);
            setIsPlaying(false);
          });
        }
      }, 50);
    } catch (err) {
      console.error("Preview failed:", err);
      alert(err.message || "Could not play preview");
      setPlayingId(null);
    } finally {
      setLoadingId(null);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const handleClosePlayer = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPlayingId(null);
    setPreviewUrl(null);
    setIsPlaying(false);
  };

  const formattedSize = (bytes) => {
    if (!bytes) return "0.0 MB";
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const getActiveItemName = () => {
    const activeItem = items.find((item) => item.id === playingId);
    return activeItem ? activeItem.file_name : "";
  };

  return (
    <div>
      {/* INLINE PLAYER (Visible when a preview is active) */}
      {previewUrl && (
        <div className={styles.playerContainer}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
              Preview Playing
            </span>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>
              {getActiveItemName()}
            </span>
          </div>

          <audio
            ref={audioRef}
            src={previewUrl}
            className={styles.audio}
            controls
            controlsList="nodownload"
            onEnded={handleAudioEnded}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onContextMenu={(e) => e.preventDefault()}
          />

          <button onClick={handleClosePlayer} className={styles.closePlayerBtn}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* ITEMS LIST */}
      <div className={styles.list}>
        {items.map((item) => {
          const isCurrent = playingId === item.id;
          const isLoading = loadingId === item.id;

          return (
            <div
              key={item.id}
              className={`${styles.row} ${isCurrent ? styles.activeRow : ""}`}
            >
              <div className={styles.actionCell}>
                {item.is_previewable ? (
                  <button
                    className={`${styles.playBtn} ${isCurrent && isPlaying ? styles.activePlayBtn : ""}`}
                    onClick={() => handlePlayToggle(item)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : isCurrent && isPlaying ? (
                      <Pause size={14} />
                    ) : (
                      <Play size={14} />
                    )}
                  </button>
                ) : (
                  <Lock size={14} className={styles.lockIcon} />
                )}
              </div>

              <span className={styles.fileName}>{item.file_name}</span>

              <div className={styles.meta}>
                <span className={styles.format}>{item.file_format || "wav"}</span>
                <span className={styles.size}>{formattedSize(item.file_size)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
