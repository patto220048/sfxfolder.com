"use client";

import React from "react";
import { useToast } from "@/app/context/ToastContext";
import { Toast } from "./Toast";
import styles from "./Toast.module.css";

export const ToastContainer = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  const isPlugin = typeof window !== 'undefined' && (window.location.search.includes('mode=plugin') || window.location.pathname.startsWith('/plugins/'));

  return (
    <div className={`${styles.toastContainer} ${isPlugin ? styles.pluginContainer : ""}`}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};
