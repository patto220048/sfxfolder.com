"use client";

import { useState } from "react";
import Link from "next/link";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  Package,
  Download,
  Crown,
  CheckCircle,
  Database,
  Info,
} from "lucide-react";
import { marked } from "marked";
import toast from "react-hot-toast";
import { useAuth } from "@/app/lib/auth-context";
import CouponInput from "../components/CouponInput";
import PackItemList from "../components/PackItemList";
import styles from "./page.module.css";

export default function PackDetailClient({
  pack,
  initialItems,
  initialHasPurchased,
  paypalClientId,
  paypalMode,
}) {
  const { user, isPremium } = useAuth();
  const { resolvedTheme } = useTheme();

  const [hasPurchased, setHasPurchased] = useState(initialHasPurchased);
  const [showSuccessState, setShowSuccessState] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const paypalColor = resolvedTheme === "dark" ? "white" : "black";

  // Calculate prices
  const currentPrice = appliedCoupon ? appliedCoupon.finalPrice : pack.price;
  const isDiscounted = pack.original_price > pack.price || appliedCoupon !== null;
  const originalDisplayPrice = appliedCoupon
    ? pack.price
    : pack.original_price;

  const formattedSize = pack.total_size
    ? `${(pack.total_size / 1024 / 1024).toFixed(1)} MB`
    : "0 MB";

  const handleDownload = async () => {
    const toastId = toast.loading("Generating download link...");
    try {
      const res = await fetch("/api/shop/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: pack.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Download failed");
      }

      toast.success("Download starting!", { id: toastId });

      // Trigger standard browser download
      const a = document.createElement("a");
      a.href = data.downloadUrl;
      a.download = `${pack.name}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      toast.error(err.message || "Download failed", { id: toastId });
    }
  };

  // Handle 100% coupon discount (Free) claim
  const handleClaimFree = async () => {
    setIsProcessing(true);
    const toastId = toast.loading("Processing free pack claim...");
    try {
      const res = await fetch("/api/shop/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packId: pack.id,
          couponCode: appliedCoupon?.code,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to claim pack");
      }

      if (data.free) {
        toast.success("Pack unlocked successfully!", { id: toastId });
        setHasPurchased(true);
        setShowSuccessState(true);
      } else {
        throw new Error("Something went wrong. Pack is not free.");
      }
    } catch (err) {
      toast.error(err.message || "Claim failed", { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoginRequest = () => {
    // Emit need-auth custom event to open the site login popup/drawer
    window.dispatchEvent(new CustomEvent("need-auth"));
  };

  const getMarkdownHtml = (text) => {
    if (!text) return "";
    try {
      return { __html: marked.parse(text) };
    } catch (e) {
      return { __html: text };
    }
  };

  // Render purchase action section
  const renderActionSection = () => {
    if (!user) {
      return (
        <button className={styles.authBtn} onClick={handleLoginRequest}>
          Log in to Purchase
        </button>
      );
    }

    if (hasPurchased) {
      return (
        <button className={styles.downloadBtn} onClick={handleDownload}>
          <Download size={18} />
          <span>Download Pack (ZIP)</span>
        </button>
      );
    }

    if (isPremium && pack.free_for_premium !== false) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--premium-gold)",
              fontSize: "0.85rem",
              fontWeight: 700,
            }}
          >
            <Crown size={16} />
            <span>Unlocked for Premium Members</span>
          </div>
          <button
            className={`${styles.downloadBtn} ${styles.premiumDownloadBtn}`}
            onClick={handleDownload}
          >
            <Download size={18} />
            <span>Download Free with Premium</span>
          </button>
        </div>
      );
    }

    // Free after coupon applied
    if (currentPrice <= 0) {
      return (
        <button
          className={styles.downloadBtn}
          onClick={handleClaimFree}
          disabled={isProcessing}
        >
          {isProcessing ? "Processing..." : "Claim Free Pack"}
        </button>
      );
    }

    // PayPal buttons
    const paypalOptions = {
      "client-id": paypalClientId,
      currency: "USD",
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <span className={styles.couponLabel}>Coupon Code</span>
          <CouponInput packId={pack.id} onApply={setAppliedCoupon} />
        </div>

        <div className={styles.divider}>Or Checkout with</div>

        {paypalClientId ? (
          <PayPalScriptProvider options={paypalOptions}>
            <PayPalButtons
              style={{
                layout: "vertical",
                color: paypalColor,
                shape: "rect",
                label: "checkout",
                tagline: false,
              }}
              disabled={isProcessing}
              createOrder={async () => {
                setIsProcessing(true);
                try {
                  const res = await fetch("/api/shop/create-order", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      packId: pack.id,
                      couponCode: appliedCoupon?.code,
                    }),
                  });
                  const orderData = await res.json();

                  if (!res.ok) {
                    throw new Error(orderData.error || "Failed to create order");
                  }

                  return orderData.orderID;
                } catch (err) {
                  toast.error(err.message || "Failed to initiate PayPal checkout");
                  setIsProcessing(false);
                  throw err;
                }
              }}
              onApprove={async (data) => {
                const toastId = toast.loading("Capturing payment...");
                try {
                  const res = await fetch("/api/shop/capture-order", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      orderID: data.orderID,
                      packId: pack.id,
                      couponId: appliedCoupon?.couponId,
                    }),
                  });
                  const captureData = await res.json();

                  if (!res.ok) {
                    throw new Error(captureData.error || "Failed to capture payment");
                  }

                  toast.success("Payment successful! Pack unlocked.", { id: toastId });
                  setHasPurchased(true);
                  setShowSuccessState(true);
                } catch (err) {
                  toast.error(err.message || "Payment verification failed", { id: toastId });
                } finally {
                  setIsProcessing(false);
                }
              }}
              onError={(err) => {
                toast.error("PayPal transaction failed. Please try again.");
                console.error("PayPal Error:", err);
                setIsProcessing(false);
              }}
              onCancel={() => {
                setIsProcessing(false);
              }}
            />
          </PayPalScriptProvider>
        ) : (
          <div
            style={{
              padding: "12px",
              border: "1px solid #ef4444",
              background: "rgba(239, 68, 68, 0.05)",
              color: "#ef4444",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Info size={16} />
            <span>Checkout is temporarily unavailable.</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <Link href="/shop" className={styles.backLink}>
        <ArrowLeft size={16} />
        <span>Back to Shop</span>
      </Link>

      <div className={styles.layout}>
        {/* COVER COLUMN */}
        <div className={styles.coverWrapper}>
          {pack.cover_image ? (
            <img
              src={pack.cover_image}
              alt={pack.name}
              className={styles.coverImage}
            />
          ) : (
            <div className={styles.coverPlaceholder}>
              <Package size={64} />
            </div>
          )}
        </div>

        {/* INFO PANEL */}
        <div className={styles.infoPanel}>
          <span className={styles.category}>{pack.category || "Audio Pack"}</span>
          <h1 className={styles.name}>{pack.name}</h1>

          <div className={styles.salesMeta}>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Package size={14} /> {pack.item_count || 0} items
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Database size={14} /> {formattedSize}
            </span>
            {pack.purchase_count > 0 && (
              <span>• {pack.purchase_count} purchases</span>
            )}
          </div>

          <div className={styles.priceSection}>
            {currentPrice > 0 ? (
              <>
                {isDiscounted && originalDisplayPrice && (
                  <span className={styles.originalPrice}>
                    ${originalDisplayPrice}
                  </span>
                )}
                <span className={styles.price}>${currentPrice.toFixed(2)}</span>
                {appliedCoupon && (
                  <span className={styles.discountBadge}>Coupon Applied</span>
                )}
              </>
            ) : (
              <span className={styles.price} style={{ color: "var(--premium-gold)" }}>
                FREE
              </span>
            )}
          </div>

          <p className={styles.shortDescription}>{pack.short_description}</p>

          {/* ACTION BUTTON / BOX */}
          {showSuccessState ? (
            <div className={styles.successContainer}>
              <CheckCircle size={36} style={{ color: "#10b981" }} />
              <h3 className={styles.successTitle}>Thank You!</h3>
              <p className={styles.successText}>
                Your purchase was successful. You can now download the sound pack.
              </p>
              <button className={styles.downloadBtn} onClick={handleDownload}>
                <Download size={18} />
                <span>Download Pack (ZIP)</span>
              </button>
            </div>
          ) : (
            <div className={styles.purchaseSection}>{renderActionSection()}</div>
          )}
        </div>
      </div>

      {/* ITEMS LIST */}
      <section className={styles.detailsSection}>
        <h2 className={styles.sectionTitle}>What&apos;s Inside</h2>
        <PackItemList items={initialItems} />
      </section>

      {/* DESCRIPTION */}
      {pack.description && (
        <section className={styles.detailsSection} style={{ marginTop: "40px" }}>
          <h2 className={styles.sectionTitle}>Product Description</h2>
          <div
            className={styles.descriptionContent}
            dangerouslySetInnerHTML={getMarkdownHtml(pack.description)}
          />
        </section>
      )}
    </div>
  );
}
