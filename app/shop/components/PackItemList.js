"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Lock, X, Loader2, Folder, ChevronRight, ChevronDown } from "lucide-react";
import styles from "./PackItemList.module.css";

// Helper functions for hierarchical tree structure
const buildTree = (items) => {
  const root = { name: "root", type: "folder", path: "", children: [] };

  items.forEach((item) => {
    const parts = (item.file_name || "").split("/");
    let currentNode = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const currentPath = parts.slice(0, i + 1).join("/");
      
      let childNode = currentNode.children.find(
        (child) => child.type === "folder" && child.name === part
      );

      if (!childNode) {
        childNode = {
          name: part,
          type: "folder",
          path: currentPath,
          children: []
        };
        currentNode.children.push(childNode);
      }
      currentNode = childNode;
    }

    currentNode.children.push({
      name: parts[parts.length - 1],
      type: "file",
      item: item
    });
  });

  return root;
};

const sortTree = (node) => {
  if (node.children) {
    node.children.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortTree);
  }
};

const countFiles = (node) => {
  if (node.type === "file") return 1;
  let count = 0;
  node.children.forEach((child) => {
    count += countFiles(child);
  });
  return count;
};

const getAllFolderPaths = (node, paths = []) => {
  if (node.type === "folder" && node.path) {
    paths.push(node.path);
  }
  if (node.children) {
    node.children.forEach((child) => getAllFolderPaths(child, paths));
  }
  return paths;
};

export default function PackItemList({ items }) {
  const [playingId, setPlayingId] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState(() => {
    const tree = buildTree(items);
    const paths = getAllFolderPaths(tree);
    const initialState = {};
    paths.forEach((path) => {
      initialState[path] = true;
    });
    return initialState;
  });
  const audioRef = useRef(null);

  // Stop audio when component unmounts
  useEffect(() => {
    const currentAudio = audioRef.current;
    return () => {
      if (currentAudio) {
        currentAudio.pause();
      }
    };
  }, []);

  // Update collapsed folders when items change
  useEffect(() => {
    const tree = buildTree(items);
    const paths = getAllFolderPaths(tree);
    const initialState = {};
    paths.forEach((path) => {
      initialState[path] = true;
    });
    setCollapsedFolders(initialState);
  }, [items]);

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

  const toggleFolderCollapse = (folderName) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderName]: !prev[folderName]
    }));
  };

  const tree = buildTree(items);
  sortTree(tree);

  const allFolderPaths = getAllFolderPaths(tree);
  const allCollapsed = allFolderPaths.every((path) => !!collapsedFolders[path]);

  const toggleAllFolders = () => {
    if (allCollapsed) {
      setCollapsedFolders({});
    } else {
      const newState = {};
      allFolderPaths.forEach((path) => {
        newState[path] = true;
      });
      setCollapsedFolders(newState);
    }
  };

  const renderNode = (node, depth = 0) => {
    if (node.type === "file") {
      const { item } = node;
      const isCurrent = playingId === item.id;
      const isLoading = loadingId === item.id;

      return (
        <div
          key={item.id}
          className={`${styles.row} ${isCurrent ? styles.activeRow : ""}`}
          style={{ paddingLeft: `${20 + depth * 16}px` }}
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

          <span className={styles.fileName}>{node.name}</span>

          <div className={styles.meta}>
            <span className={styles.format}>{item.file_format || "wav"}</span>
            <span className={styles.size}>{formattedSize(item.file_size)}</span>
          </div>
        </div>
      );
    }

    const isCollapsed = !!collapsedFolders[node.path];
    const folderItemsCount = countFiles(node);

    return (
      <div key={node.path || "root"} className={styles.folderGroup}>
        {node.path && (
          <div
            className={styles.folderGroupHeader}
            style={{ paddingLeft: `${20 + (depth - 1) * 16}px` }}
          >
            <button
              type="button"
              className={styles.collapseToggleBtn}
              onClick={() => toggleFolderCollapse(node.path)}
            >
              {isCollapsed ? (
                <ChevronRight size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
            </button>
            
            <div className={styles.folderHeaderInfo} onClick={() => toggleFolderCollapse(node.path)}>
              <Folder size={16} className={styles.folderIcon} style={{ color: "var(--premium-gold, #FACB11)" }} />
              <span className={styles.folderHeaderName}>{node.name}</span>
              <span className={styles.folderItemCount}>({folderItemsCount} {folderItemsCount === 1 ? "item" : "items"})</span>
            </div>
          </div>
        )}

        {(!isCollapsed || !node.path) && (
          <div className={node.path ? styles.folderGroupContent : ""}>
            {node.children.map((child) => renderNode(child, node.path ? depth + 1 : depth))}
          </div>
        )}
      </div>
    );
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

      {/* TOOLBAR */}
      {allFolderPaths.length > 0 && (
        <div className={styles.toolbar}>
          <div className={styles.toolbarInfo}>
            <Folder size={14} className={styles.toolbarIcon} />
            <span>{allFolderPaths.length} {allFolderPaths.length === 1 ? "folder" : "folders"}</span>
          </div>
          <button
            type="button"
            className={styles.toggleAllBtn}
            onClick={toggleAllFolders}
          >
            {allCollapsed ? "Expand All" : "Collapse All"}
          </button>
        </div>
      )}

      {/* ITEMS LIST */}
      <div className={styles.list}>
        {items.length === 0 ? (
          <div className={styles.emptyItems} style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>
            This pack contains no items.
          </div>
        ) : (
          renderNode(tree)
        )}
      </div>
    </div>
  );
}
