"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Save, Copy } from "lucide-react";
import TagInput from "@/app/components/ui/TagInput";
import TreeSelect from "@/app/components/ui/TreeSelect";
import styles from "./BulkEditModal.module.css";

export default function BulkEditModal({ 
  isOpen, 
  onClose, 
  selectedResources, 
  folders = [], 
  categories = [], 
  onSave 
}) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (isOpen && selectedResources) {
      setItems(selectedResources.map(r => ({
        id: r.id,
        name: r.name || r.fileName || "",
        tags: r.tags || [],
        categoryId: r.categoryId || "",
        folderId: r.folderId || ""
      })));
    }
  }, [isOpen, selectedResources]);

  // Pre-calculate hierarchical folders for each category (or global)
  // This avoids re-calculating on every row render and ensures TreeSelect labels (indentation)
  const getHierarchicalFolders = useMemo(() => {
    const buildTree = (allFolders, categorySlug, parentId = null, depth = 0) => {
      let result = [];
      const children = allFolders.filter(f => 
        f.parentId === parentId && 
        (!categorySlug || f.categorySlug === categorySlug)
      );
      
      children.forEach(folder => {
        result.push({ 
          id: folder.id,
          name: folder.name,
          parentId: folder.parentId,
          categorySlug: folder.categorySlug,
          // Using \u2014 (em-dash) specifically to match TreeSelect's regex
          label: `${depth > 0 ? "\u2014".repeat(depth) + " " : ""}${folder.name}` 
        });
        result = [...result, ...buildTree(allFolders, categorySlug, folder.id, depth + 1)];
      });
      return result;
    };

    // Return a cache of trees per category
    const trees = {
      global: buildTree(folders, null)
    };
    categories.forEach(cat => {
      trees[cat.slug] = buildTree(folders, cat.slug);
    });
    return trees;
  }, [folders, categories]);

  if (!isOpen) return null;

  const handleChange = (id, field, value) => {
    const newItems = items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    );
    
    // If category changes, we should clear folder if it belongs to a different category
    if (field === 'categoryId') {
      const changedItem = newItems.find(i => i.id === id);
      if (changedItem.folderId) {
        const folder = folders.find(f => f.id === changedItem.folderId);
        if (folder && folder.categorySlug !== value) {
          changedItem.folderId = "";
        }
      }
    }
    
    setItems(newItems);
  };

  const handleApplyToAll = (field) => {
    if (items.length < 2) return;
    const valueToApply = items[0][field];
    
    setItems(prev => prev.map((item, idx) => {
      if (idx === 0) return item;
      
      const newItem = { ...item, [field]: valueToApply };
      
      // Safety check for category change
      if (field === 'categoryId' && item.folderId) {
        const folder = folders.find(f => f.id === item.folderId);
        if (folder && folder.categorySlug !== valueToApply) {
          newItem.folderId = "";
        }
      }
      
      return newItem;
    }));
  };

  const handleSave = () => {
    onSave(items);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Chỉnh sửa hàng loạt ({items.length} mục)</h2>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={24} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.colName}>Tên tài nguyên</th>
                  <th className={styles.colTags}>
                    <div className={styles.headerCell}>
                      <span>Tags</span>
                      <button 
                        className={styles.applyAllBtn} 
                        onClick={() => handleApplyToAll('tags')}
                        title="Áp dụng Tags của dòng đầu cho tất cả"
                      >
                        <Copy size={12} /> Áp dụng hết
                      </button>
                    </div>
                  </th>
                  <th className={styles.colCategory}>
                    <div className={styles.headerCell}>
                      <span>Danh mục</span>
                      <button 
                        className={styles.applyAllBtn} 
                        onClick={() => handleApplyToAll('categoryId')}
                        title="Áp dụng Danh mục của dòng đầu cho tất cả"
                      >
                        <Copy size={12} /> Áp dụng hết
                      </button>
                    </div>
                  </th>
                  <th className={styles.colFolder}>
                    <div className={styles.headerCell}>
                      <span>Thư mục</span>
                      <button 
                        className={styles.applyAllBtn} 
                        onClick={() => handleApplyToAll('folderId')}
                        title="Áp dụng Thư mục của dòng đầu cho tất cả"
                      >
                        <Copy size={12} /> Áp dụng hết
                      </button>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <input 
                        type="text" 
                        value={item.name} 
                        onChange={(e) => handleChange(item.id, 'name', e.target.value)}
                        className={styles.nameInput}
                      />
                    </td>
                    <td>
                      <TagInput 
                        tags={item.tags} 
                        onChange={(tags) => handleChange(item.id, 'tags', tags)} 
                      />
                    </td>
                    <td>
                      <select 
                        value={item.categoryId} 
                        onChange={(e) => handleChange(item.id, 'categoryId', e.target.value)}
                        className={styles.select}
                      >
                        <option value="">Chọn danh mục...</option>
                        {categories.map(cat => (
                          <option key={cat.slug} value={cat.slug}>{cat.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <TreeSelect 
                        options={getHierarchicalFolders[item.categoryId] || getHierarchicalFolders.global}
                        value={item.folderId}
                        onChange={(val) => handleChange(item.id, 'folderId', val)}
                        placeholder="Chọn thư mục..."
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.footer}>
          <button onClick={onClose} className={styles.cancelBtn}>Hủy bỏ</button>
          <button onClick={handleSave} className={styles.saveBtn}>
            <Save size={18} />
            Lưu tất cả thay đổi
          </button>
        </div>
      </div>
    </div>
  );
}
