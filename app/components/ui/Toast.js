"use client";

import React from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import styles from "./Toast.module.css";

const getIcon = (type, isPlugin) => {
  const size = isPlugin ? 14 : 18;
  switch (type) {
    case "success":
      return <CheckCircle size={size} color="#00FFCC" />;
    case "error":
      return <AlertCircle size={size} color="#FF3366" />;
    default:
      return <Info size={size} color="white" />;
  }
};

export const Toast = ({ message, type, onClose }) => {
  const isPlugin = typeof window !== 'undefined' && (window.location.search.includes('mode=plugin') || window.location.pathname.startsWith('/plugins/'));

  return (
    <div className={`${styles.toast} ${styles[type]} ${isPlugin ? styles.pluginToast : ""}`}>
      <div className={styles.icon}>
        {getIcon(type, isPlugin)}
      </div>
      <div className={styles.toastContent}>
        <span className={styles.message}>{message}</span>
        <span className={styles.type}>{type}</span>
      </div>
      <button className={styles.closeButton} onClick={onClose}>
        <X size={isPlugin ? 12 : 16} />
      </button>
    </div>
  );
};
