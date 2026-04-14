"use client";

import { X, CheckCircle, AlertCircle, Loader2, Upload, FileIcon, Trash2 } from "lucide-react";
import styles from "./UploadDrawer.module.css";
import TagInput from "../../../components/ui/TagInput";

const CATEGORIES = [
  { slug: "sound-effects", name: "Sound Effects" },
  { slug: "music", name: "Music" },
  { slug: "video-meme", name: "Video Meme" },
  { slug: "green-screen", name: "Green Screen" },
  { slug: "animation", name: "Animation" },
  { slug: "image-overlay", name: "Image & Overlay" },
  { slug: "font", name: "Font" },
  { slug: "preset-lut", name: "Preset & LUT" },
];

export default function UploadDrawer({ 
  files, 
  isOpen, 
  onClose, 
  onUpdate, 
  onRemove, 
  onUpload, 
  isUploading, 
  progress 
}) {
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
            {files.map((file) => (
              <div key={file.id} className={`${styles.fileCard} ${styles[file.status]}`}>
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
                      value={file.category} 
                      onChange={(e) => onUpdate(file.id, 'category', e.target.value)}
                      disabled={isUploading || file.status === 'success'}
                      className={!file.category ? styles.inputError : ""}
                    >
                      <option value="">Chọn danh mục...</option>
                      {CATEGORIES.map(c => (
                        <option key={c.slug} value={c.slug}>{c.name}</option>
                      ))}
                    </select>
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
