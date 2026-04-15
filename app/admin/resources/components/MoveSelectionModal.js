"use client";

import { useState, useMemo } from "react";
import { X, Move, Folder } from "lucide-react";
import styles from "./MoveSelectionModal.module.css";
import TreeSelect from "@/app/components/ui/TreeSelect";

export default function MoveSelectionModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  selectedCount, 
  folders 
}) {
  const [targetId, setTargetId] = useState("root_folder");

  const folderOptions = useMemo(() => {
    const buildOptions = (items, level = 0) => {
      let result = [];
      items.forEach(item => {
        const indent = "— ".repeat(level);
        result.push({ 
          id: item.id, 
          label: `${indent}${item.name}`,
          name: item.name // Also pass clean name for searching
        });
        if (item.children && item.children.length > 0) {
          result = [...result, ...buildOptions(item.children, level + 1)];
        }
      });
      return result;
    };

    // Group folders by category for a cleaner list
    const categories = Array.from(new Set(folders.map(f => f.categorySlug)));
    let allOptions = [{ id: "root_folder", label: "📁 — Thư mục gốc —", name: "Thư mục gốc" }];

    categories.forEach(catSlug => {
      const catFolders = folders.filter(f => f.categorySlug === catSlug);
      
      const buildTree = (list, pId) => {
        // Robust check for root level (null, undefined, or empty string)
        return list.filter(i => {
          if (!pId) return !i.parentId;
          return i.parentId === pId;
        }).map(i => ({
          ...i,
          children: buildTree(list, i.id)
        }));
      };

      const tree = buildTree(catFolders, null);
      if (tree.length > 0) {
        // Add a category header of sorts? Or just add the items
        allOptions = [...allOptions, ...buildOptions(tree)];
      }
    });

    return allOptions;
  }, [folders]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Di chuyển tài nguyên</h2>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.selectionInfo}>
            <p>Đang di chuyển <strong>{selectedCount}</strong> tài nguyên đã chọn.</p>
          </div>

          <div className={styles.fieldGroup}>
            <label>Chọn thư mục đích</label>
            <TreeSelect 
              value={targetId}
              onChange={setTargetId}
              options={folderOptions}
              placeholder="Chọn thư mục..."
            />
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Hủy
          </button>
          <button 
            className={styles.confirmBtn} 
            onClick={() => onConfirm(targetId === "root_folder" ? null : targetId)}
            disabled={!targetId}
          >
            <Move size={16} />
            Xác nhận di chuyển
          </button>
        </div>
      </div>
    </div>
  );
}
