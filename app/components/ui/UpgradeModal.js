"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, ArrowUpCircle } from "lucide-react";
import styles from "./UpgradeModal.module.css";
import { PayPalButtons } from "@paypal/react-paypal-js";

export default function UpgradeModal({ 
  isOpen, 
  onClose, 
  currentPlanName, 
  expiresAt,
  paypalOptions,
  onApprove,
  isProcessing
}) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className={styles.overlay} onClick={onClose}>
        <motion.div 
          className={styles.modal}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={24} />
          </button>

          <div className={styles.content}>
            <div className={styles.header}>
              <div className={styles.iconWrapper}>
                <ArrowUpCircle size={40} className={styles.icon} />
              </div>
              <h2>Upgrade to Yearly Plan</h2>
              <p>Get the best value and unlock all premium features for a full year.</p>
            </div>

            <div className={styles.infoBox}>
              <div className={styles.infoRow}>
                <span className={styles.label}>Current Plan:</span>
                <span className={styles.value}>{currentPlanName}</span>
              </div>
              {expiresAt && (
                <div className={styles.infoRow}>
                  <span className={styles.label}>Next Billing:</span>
                  <span className={styles.value}>
                    {new Date(expiresAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            <div className={styles.warningBox}>
              <AlertTriangle size={20} className={styles.warningIcon} />
              <p>
                <strong>Important:</strong> Your current Monthly plan will be automatically canceled upon successful upgrade to avoid duplicate charges.
              </p>
            </div>

            <div className={styles.actionArea}>
              <p className={styles.confirmText}>Confirm your upgrade to Yearly Plan ($18/year):</p>
              <div className={styles.paypalContainer}>
                <PayPalButtons
                  style={{ layout: "horizontal", color: "black", label: "subscribe" }}
                  createSubscription={(data, actions) => {
                    return actions.subscription.create({
                      plan_id: paypalOptions.planId,
                    });
                  }}
                  onApprove={onApprove}
                  disabled={isProcessing}
                />
              </div>
            </div>
            
            <button className={styles.cancelBtn} onClick={onClose}>
              Maybe later
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
