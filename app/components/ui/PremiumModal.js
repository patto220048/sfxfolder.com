"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Crown } from "lucide-react";
import styles from "./PremiumModal.module.css";
import { useAuth } from "@/app/lib/auth-context";

export default function PremiumModal({ isOpen, onClose }) {
  const router = useRouter();
  const modalRef = useRef(null);
  const { user } = useAuth();

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleUpgrade = () => {
    onClose();
    const isPlugin = typeof window !== 'undefined' && (window.location.search.includes('mode=plugin') || window.location.pathname.startsWith('/plugins/'));
    if (isPlugin && typeof window !== 'undefined') {
      const pricingUrl = `${window.location.origin}/pricing`;
      if (window.__adobe_cep__ && window.cep && window.cep.util) {
        window.cep.util.openURLInDefaultBrowser(pricingUrl);
      } else if (window.parent) {
        window.parent.postMessage({ type: 'OPEN_URL', url: pricingUrl }, '*');
      }
    } else {
      router.push("/pricing");
    }
  };

  const handleLogin = () => {
    onClose();
    window.dispatchEvent(new CustomEvent("need-auth"));
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div className={styles.modal} ref={modalRef}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        <div className={styles.iconWrap}>
          <Crown size={32} />
        </div>

        <h2 className={styles.title}>Premium Required</h2>
        <p className={styles.subtitle}>
          This resource is exclusive to our premium members. Upgrade your account to unlock unlimited downloads.
        </p>

        <button className={styles.upgradeBtn} onClick={handleUpgrade}>
          Get Premium Access
        </button>

        {!user && (
          <div className={styles.loginLink}>
            Already have premium? 
            <button onClick={handleLogin}>Log in here</button>
          </div>
        )}
      </div>
    </div>
  );
}
