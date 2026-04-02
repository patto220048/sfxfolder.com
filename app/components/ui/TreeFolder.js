"use client";

import { useState } from "react";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import styles from "./TreeFolder.module.css";

function TreeItem({ folder, selectedPath, onSelect, level = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = folder.children && folder.children.length > 0;
  const isSelected = selectedPath === folder.path;

  return (
    <li className={styles.item}>
      <button
        className={`${styles.row} ${isSelected ? styles.active : ""}`}
        style={{ paddingLeft: `${12 + level * 16}px` }}
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          onSelect(folder.path);
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
              key={child.path}
              folder={child}
              selectedPath={selectedPath}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function TreeFolder({ folders = [], selectedPath, onSelect }) {
  return (
    <nav className={styles.tree} aria-label="Folder navigation">
      <ul className={styles.list}>
        {folders.map((folder) => (
          <TreeItem
            key={folder.path}
            folder={folder}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </nav>
  );
}
