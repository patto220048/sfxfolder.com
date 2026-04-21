"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import styles from "./TreeFolder.module.css";

function TreeItem({ folder, selectedFolderId, onSelect, primaryColor, level = 0 }) {
  const hasSelectedChild = useMemo(() => {
    if (!selectedFolderId || !folder.children) return false;
    const check = (f) => {
      if (f.id === selectedFolderId) return true;
      if (f.children) return f.children.some(check);
      return false;
    };
    return folder.children.some(check);
  }, [folder.children, selectedFolderId]);

  const [expanded, setExpanded] = useState(hasSelectedChild);

  useEffect(() => {
    if (hasSelectedChild) setExpanded(true);
  }, [hasSelectedChild]);

  const hasChildren = folder.children && folder.children.length > 0;
  const isSelected = selectedFolderId === folder.id;

  return (
    <li className={styles.item}>
      <button
        className={`${styles.row} ${isSelected ? styles.active : ""}`}
        style={{ paddingLeft: `${12 + level * 16}px` }}
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          onSelect(folder);
        }}
      >
        {hasChildren && (
          <ChevronRight
            size={14}
            className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}
          />
        )}
        {!hasChildren && <span className={styles.spacer} />}
        {expanded ? (
          <FolderOpen size={16} className={styles.folderIcon} />
        ) : (
          <Folder size={16} className={styles.folderIcon} />
        )}
        <span className={styles.name}>{folder.name}</span>
        {folder.resourceCount > 0 && (
          <span className={styles.count}>{folder.resourceCount}</span>
        )}
      </button>
      {hasChildren && expanded && (
        <ul className={styles.children}>
          {folder.children.map((child) => (
            <TreeItem
              key={child.id}
              folder={child}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              primaryColor={primaryColor}
              level={level + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function TreeFolder({ folders = [], selectedFolderId, onSelect, primaryColor }) {
  return (
    <nav 
      className={styles.tree} 
      aria-label="Folder navigation"
      style={{ "--cat-color": primaryColor }}
    >
      <ul className={styles.list}>
        {folders.map((folder) => (
          <TreeItem
            key={folder.id}
            folder={folder}
            selectedFolderId={selectedFolderId}
            onSelect={onSelect}
            primaryColor={primaryColor}
          />
        ))}
      </ul>
    </nav>
  );
}
