"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, CalendarDays, XCircle, CheckCircle2, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import styles from "./page.module.css";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function StatusBadge({ status }) {
  const map = {
    ACTIVE: { label: "Active", color: "#22c55e", icon: CheckCircle2 },
    CANCELLED: { label: "Cancelled", color: "#f43f5e", icon: XCircle },
    EXPIRED: { label: "Expired", color: "#94a3b8", icon: XCircle },
    SUSPENDED: { label: "Suspended", color: "#f59e0b", icon: AlertCircle },
  };
  const cfg = map[status] || { label: status, color: "#94a3b8", icon: AlertCircle };
  const Icon = cfg.icon;
  return (
    <span className={styles.statusBadge} style={{ color: cfg.color, borderColor: cfg.color }}>
      <Icon size={14} />
      {cfg.label}
    </span>
  );
}

export default function SubscriptionClient({ subscription, planLabel, userEmail }) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const isActive = subscription?.status === "ACTIVE";
  const isCancelled = subscription?.status === "CANCELLED" || subscription?.status === "EXPIRED";

  const handleCancelRequest = () => setShowConfirm(true);
  const handleCancelAbort = () => setShowConfirm(false);

  const handleCancelConfirm = async () => {
    setCancelling(true);
    setShowConfirm(false);
    const toastId = toast.loading("Cancelling your subscription...");

    try {
      const res = await fetch("/api/paypal/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionID: subscription.paypal_subscription_id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cancellation failed");

      toast.success("Subscription cancelled. You'll retain access until the end of your billing period.", { id: toastId, duration: 6000 });
      // Hard reload to update status
      window.location.reload();
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Crown size={32} />
        <h1 className={styles.title}>My Subscription</h1>
        <p className={styles.subtitle}>{userEmail}</p>
      </div>

      {!subscription ? (
        <div className={styles.card}>
          <p className={styles.emptyText}>You don't have an active subscription.</p>
          <a href="/pricing" className={styles.upgradeBtn}>View Premium Plans</a>
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.label}>Plan</span>
            <span className={styles.value}>{planLabel}</span>
          </div>

          <div className={styles.row}>
            <span className={styles.label}>Status</span>
            <StatusBadge status={subscription.status} />
          </div>

          <div className={styles.row}>
            <span className={styles.label}>
              <CalendarDays size={15} style={{ display: "inline", marginRight: 4 }} />
              Started
            </span>
            <span className={styles.value}>{formatDate(subscription.current_period_start)}</span>
          </div>

          <div className={styles.row}>
            <span className={styles.label}>
              <CalendarDays size={15} style={{ display: "inline", marginRight: 4 }} />
              {isActive ? "Renews on" : "Expires on"}
            </span>
            <span className={styles.value}>{formatDate(subscription.current_period_end)}</span>
          </div>

          <div className={styles.row}>
            <span className={styles.label}>Subscription ID</span>
            <span className={styles.valueSmall}>{subscription.paypal_subscription_id}</span>
          </div>

          {isActive && (
            <>
              <div className={styles.divider} />
              {!showConfirm ? (
                <button
                  className={styles.cancelBtn}
                  onClick={handleCancelRequest}
                  disabled={cancelling}
                >
                  <XCircle size={16} />
                  Cancel Subscription
                </button>
              ) : (
                <div className={styles.confirmBox}>
                  <p className={styles.confirmText}>
                    Are you sure? You'll lose Premium access at the end of the current billing period.
                  </p>
                  <div className={styles.confirmActions}>
                    <button className={styles.confirmYes} onClick={handleCancelConfirm} disabled={cancelling}>
                      Yes, Cancel
                    </button>
                    <button className={styles.confirmNo} onClick={handleCancelAbort}>
                      Keep Premium
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {isCancelled && (
            <>
              <div className={styles.divider} />
              <a href="/pricing" className={styles.upgradeBtn}>Resubscribe</a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
