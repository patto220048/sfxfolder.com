"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { triggerSideFireworks } from "@/app/lib/confetti";
import { useAuth } from "@/app/lib/auth-context";
import styles from "./SuccessModal.module.css";

export default function SuccessModal({ isOpen, onClose }) {
  const { user, profile } = useAuth();
  const [crowned, setCrowned] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Small delay before fireworks and sound
      const timer = setTimeout(() => {
        triggerSideFireworks();
        playSuccessSound();
      }, 300);

      const crownTimer = setTimeout(() => setCrowned(true), 500);

      return () => {
        clearTimeout(timer);
        clearTimeout(crownTimer);
      };
    } else {
      setCrowned(false);
    }
  }, [isOpen]);

  const playSuccessSound = () => {
    try {
      const audio = new Audio("https://cdn.pixabay.com/audio/2022/01/21/audio_73147743d7.mp3?filename=success-fanfare-trumpets-6185.mp3");
      audio.volume = 0.2;
      audio.play();
    } catch (err) {
      console.warn("Audio playback failed:", err);
    }
  };

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Member";
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || null;
  const initials = displayName.charAt(0).toUpperCase();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className={styles.overlay}>
          <motion.div 
            className={styles.modal}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className={styles.avatarContainer}>

              <div className={`${styles.avatarCircle} ${crowned ? styles.crowned : ""}`}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className={styles.avatarImg} />
                ) : (
                  <div className={styles.avatarFallback}>{initials}</div>
                )}
              </div>
            </div>

            <h2 className={styles.title}>Thank You!</h2>
            <p className={styles.message}>
              Welcome to the Premium family, <strong>{displayName}</strong>! <br />
              All exclusive resources are now unlocked for you.
            </p>

            <button className={styles.goHomeBtn} onClick={() => window.location.href = "/"}>
              Start Exploring
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
