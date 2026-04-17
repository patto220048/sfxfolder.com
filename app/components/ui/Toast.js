"use client";

import React from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import styles from "./Toast.module.css";

const IconMap = {
  success: <CheckCircle size={18} color="#00FFCC" />,
  error: <AlertCircle size={18} color="#FF3366" />,
  info: <Info size={18} color="white" />,
};

export const Toast = ({ message, type, onClose }) => {
  return (
    <div className={`${styles.toast} ${styles[type]}`}>
      <div className={styles.icon}>
        {IconMap[type] || IconMap.info}
      </div>
      <div className={styles.toastContent}>
        <span className={styles.message}>{message}</span>
        <span className={styles.type}>{type}</span>
      </div>
      <button className={styles.closeButton} onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  );
};
