"use client";

import { useState } from "react";
import { Loader2, Check, AlertCircle } from "lucide-react";
import styles from "./CouponInput.module.css";

export default function CouponInput({ packId, onApply, disabled }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [status, setStatus] = useState("idle"); // idle, success, error

  const handleApply = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setMessage(null);
    setStatus("idle");

    try {
      const res = await fetch("/api/shop/validate-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.toUpperCase().trim(), packId }),
      });

      const data = await res.json();

      if (!res.ok || data.valid === false) {
        setStatus("error");
        setMessage(data.error || "Invalid coupon code");
        onApply(null);
      } else {
        setStatus("success");
        setMessage(
          `Coupon applied! Discount: ${
            data.discountType === "percent"
              ? `${data.discountValue}%`
              : `$${data.discountValue}`
          }`
        );
        onApply({
          code: code.toUpperCase().trim(),
          couponId: data.couponId,
          finalPrice: data.finalPrice,
          discountValue: data.discountValue,
          discountType: data.discountType,
        });
      }
    } catch (err) {
      setStatus("error");
      setMessage("Failed to validate coupon");
      onApply(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <form onSubmit={handleApply} className={styles.inputGroup}>
        <input
          type="text"
          className={styles.input}
          placeholder="DISCOUNT CODE"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={disabled || loading}
        />
        <button
          type="submit"
          className={styles.button}
          disabled={disabled || loading || !code.trim()}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : "Apply"}
        </button>
      </form>

      {message && (
        <span
          className={`${styles.message} ${
            status === "success" ? styles.success : styles.error
          }`}
          style={{ display: "flex", alignItems: "center", gap: "4px" }}
        >
          {status === "success" ? (
            <Check size={12} />
          ) : (
            <AlertCircle size={12} />
          )}
          {message}
        </span>
      )}
    </div>
  );
}
