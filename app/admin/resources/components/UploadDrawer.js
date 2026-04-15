"use client";

import { useState, useMemo } from "react";
import { X, CheckCircle, AlertCircle, Loader2, Upload, FileIcon, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import styles from "./UploadDrawer.module.css";
import TagInput from "../../../components/ui/TagInput";
import TreeSelect from "../../../components/ui/TreeSelect";

export default function UploadDrawer({ 
  files, 
  folders = [],
  categories = [], 
  isOpen, 
  onClose, 
  onUpdate, 
  onUpdateBulk,
  onRemove, 
  onUpload, 
  isUploading, 
  progress 
}) {
  const [bulkMeta, setBulkMeta] = useState({ displayName: "", category: "", folderId: "", tags: [] });
  const [showBulk, setShowBulk] = useState(false);

  const getHierarchicalFolders = useMemo(() => {
    return (categorySlug) => {
      const categoryFolders = folders.filter(f => f.categorySlug === categorySlug);
      
      const buildTree = (parentId = null, depth = 0) => {
        let result = [];
        const children = categoryFolders.filter(f => f.parentId === parentId);
        children.forEach(folder => {
          result.push({ 
            ...folder, 
            label: `${depth > 0 ? '—'.repeat(depth) + ' ' : ''}${folder.name}` 
          });
          result = [...result, ...buildTree(folder.id, depth + 1)];
        });
        return result;
      };
      
      return buildTree();
    };
  }, [folders]);

  if (!isOpen && files.length === 0) return null;

  return (
    <div className={`${styles.drawer} ${isOpen || files.length > 0 ? styles.open : ""}`}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Upload size={20} />
          <h3>Kiểm tra tài nguyên ({files.length})</h3>
        </div>
        <button onClick={onClose} className={styles.closeBtn}>
          <X size={20} />
        </button>
      </div>

      <div className={styles.content}>
        {files.length === 0 ? (
          <div className={styles.empty}>
            <Upload size={48} className={styles.emptyIcon} strokeWidth={1} />
            <p>Chưa có file nào được chọn</p>
          </div>
        ) : (
          <div className={styles.fileList}>
            <div className={styles.bulkSection}>
              <button 
                className={styles.bulkToggle}
                onClick={() => setShowBulk(!showBulk)}
              >
                <span>Thiết lập nhanh cho tất cả ({files.length} file)</span>
                {showBulk ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              
              {showBulk && (
                <div className={styles.bulkForm}>
                  <div className={styles.bulkGrid}>
                    <div className={styles.inputGroup}>
                      <label>Tên hiển thị chung</label>
                      <input 
                        type="text"
                        value={bulkMeta.displayName}
                        onChange={(e) => setBulkMeta({ ...bulkMeta, displayName: e.target.value })}
                        placeholder="Giữ nguyên..."
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label>Danh mục chung</label>
                      <select 
                        value={bulkMeta.category}
                        onChange={(e) => setBulkMeta({ ...bulkMeta, category: e.target.value })}
                      >
                        <option value="">Chọn danh mục...</option>
                        {categories.map(cat => (
                          <option key={cat.slug} value={cat.slug}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.inputGroup}>
                      <label>Thư mục chung</label>
                      <TreeSelect 
                        options={getHierarchicalFolders(bulkMeta.category)}
                        value={bulkMeta.folderId}
                        onChange={(id) => setBulkMeta({ ...bulkMeta, folderId: id })}
                        placeholder="Giữ nguyên..."
                        disabled={!bulkMeta.category}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label>Tags chung</label>
                      <TagInput 
                        tags={bulkMeta.tags}
                        onChange={(tags) => setBulkMeta({ ...bulkMeta, tags })}
                      />
                    </div>
                  </div>
                  
                  <button 
                    className={styles.applyBtn}
                    onClick={() => {
                      onUpdateBulk(bulkMeta);
                      setShowBulk(false);
                    }}
                  >
                    Áp dụng cho tất cả
                  </button>
                </div>
              )}
            </div>

            {files.map((file, index) => (
              <div 
                key={file.id} 
                className={`${styles.fileCard} ${styles[file.status]}`}
                style={{ zIndex: files.length - index }}
              >
                <div className={styles.fileHeader}>
                  <FileIcon size={18} className={styles.fileIcon} />
                  <span className={styles.fileName} title={file.name}>{file.name}</span>
                  <button 
                    onClick={() => onRemove(file.id)} 
                    className={styles.removeBtn}
                    disabled={isUploading || file.status === 'success'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className={styles.fileInputs}>
                  <div className={styles.inputGroup}>
                    <label>Tên hiển thị</label>
                    <input 
                      type="text" 
                      value={file.displayName} 
                      onChange={(e) => onUpdate(file.id, 'displayName', e.target.value)}
                      disabled={isUploading || file.status === 'success'}
                      placeholder="Nhập tên..."
                    />
                  </div>

                    <div className={styles.inputGroup}>
                      <label>Danh mục</label>
                      <select 
                        value={file.categoryId} 
                        onChange={(e) => onUpdate(file.id, 'categoryId', e.target.value)}
                        disabled={isUploading || file.status === 'success'}
                        className={!file.categoryId ? styles.inputError : ""}
                      >
                        <option value="">Chọn danh mục...</option>
                        {categories.map(cat => (
                          <option key={cat.slug} value={cat.slug}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className={styles.inputGroup}>
                      <label>Thư mục đầu vào (Tùy chọn)</label>
                      <TreeSelect 
                        options={getHierarchicalFolders(file.categoryId)}
                        value={file.folderId || ""}
                        onChange={(id) => onUpdate(file.id, 'folderId', id)}
                        disabled={isUploading || file.status === 'success'}
                        placeholder="Chọn thư mục..."
                      />
                    </div>

                  <div className={styles.inputGroup}>
                    <label>Tags (Nhấn Enter để tách thẻ)</label>
                    <TagInput 
                      tags={file.tags} 
                      onChange={(newTags) => onUpdate(file.id, 'tags', newTags)}
                      disabled={isUploading || file.status === 'success'}
                    />
                  </div>
                </div>

                <div className={styles.statusBadge}>
                  {file.status === 'uploading' && <Loader2 size={14} className="animate-spin" />}
                  {file.status === 'success' && <CheckCircle size={14} />}
                  {file.status === 'error' && <AlertCircle size={14} />}
                  <span>{file.status.charAt(0).toUpperCase() + file.status.slice(1)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        {isUploading && (
          <div className={styles.progressContainer}>
            <div className={styles.progressText}>
              <span>Đang tải lên...</span>
              <span>{progress}%</span>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <button 
          className={styles.uploadBtn} 
          onClick={onUpload}
          disabled={isUploading || files.length === 0 || files.every(f => f.status === 'success')}
        >
          {isUploading ? "Đang xử lý..." : "Bắt đầu tải lên tất cả"}
        </button>
      </div>
    </div>
  );
}
