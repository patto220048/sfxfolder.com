"use client";

import { UploadCloud } from "lucide-react";
import styles from "./AdminDropOverlay.module.css";

export default function AdminDropOverlay({ isDragging }) {
  if (!isDragging) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        <div className={styles.iconWrapper}>
          <UploadCloud size={64} className={styles.icon} />
        </div>
        <h2 className={styles.title}>Thả file hoặc thư mục để bắt đầu</h2>
        <p className={styles.subtitle}>Hệ thống sẽ tự động dọn dẹp tên và xác định danh mục cho bạn</p>
        
        <div className={styles.glow} />
      </div>
    </div>
  );
}
