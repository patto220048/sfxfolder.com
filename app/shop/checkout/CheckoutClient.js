"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  Package,
  Download,
  CheckCircle,
  Lock,
  Info,
  Loader2,
  User,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/app/lib/auth-context";
import { supabase } from "@/app/lib/supabase";
import CouponInput from "../components/CouponInput";
import styles from "./page.module.css";

export default function CheckoutClient({ pack, paypalClientId }) {
  const { user, isPremium } = useAuth();
  const { resolvedTheme } = useTheme();

  const { loginWithEmail, signup, loginWithGoogle } = useAuth();

  // Auth Form State
  const [authMode, setAuthMode] = useState("login"); // "login" | "signup"
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [hasPurchased, setHasPurchased] = useState(false);
  const [loadingPurchase, setLoadingPurchase] = useState(true);
  const [showSuccessState, setShowSuccessState] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Check if user has already purchased this pack
  useEffect(() => {
    if (user) {
      async function checkPurchase() {
        try {
          const { data, error } = await supabase
            .from("pack_purchases")
            .select("id")
            .eq("user_id", user.id)
            .eq("pack_id", pack.id)
            .eq("status", "completed")
            .maybeSingle();

          if (!error && data) {
            setHasPurchased(true);
          }
        } catch (e) {
          console.error("Failed to check purchase status:", e);
        } finally {
          setLoadingPurchase(false);
        }
      }
      checkPurchase();
    } else {
      setLoadingPurchase(false);
    }
  }, [user, pack.id]);

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

      // Trigger browser download
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

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");

    if (!authEmail.trim()) {
      setAuthError("Please enter your email");
      return;
    }
    if (!authPassword) {
      setAuthError("Please enter your password");
      return;
    }

    setAuthLoading(true);
    try {
      if (authMode === "login") {
        await loginWithEmail(authEmail, authPassword);
        toast.success("Successfully logged in!");
      } else {
        if (authPassword.length < 8) {
          throw new Error("Password must be at least 8 characters long");
        }
        if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(authPassword)) {
          throw new Error("Password must contain at least one letter and one number");
        }

        const currentPath = window.location.pathname + window.location.search;
        const { user: registeredUser } = await signup(authEmail, authPassword, "", currentPath);

        if (registeredUser && !registeredUser.confirmed_at) {
          setAuthSuccess("Check your email for a confirmation link to complete sign up.");
          toast.success("Account created! Verification link sent.");
        } else {
          toast.success("Account created successfully!");
        }
      }
    } catch (err) {
      setAuthError(err.message || "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthError("");
    try {
      const currentPath = window.location.pathname + window.location.search;
      await loginWithGoogle(currentPath);
    } catch (err) {
      setAuthError(err.message || "Google authentication failed");
    }
  };

  const handleLoginRequest = () => {
    window.dispatchEvent(new CustomEvent("need-auth"));
  };

  const formattedSize = pack.total_size
    ? `${(pack.total_size / 1024 / 1024).toFixed(1)} MB`
    : "0 MB";

  const currentPrice = appliedCoupon ? appliedCoupon.finalPrice : pack.price;
  const isDiscounted = pack.original_price > pack.price || appliedCoupon !== null;
  const originalDisplayPrice = appliedCoupon
    ? pack.price
    : pack.original_price;

  const paypalColor = "gold";

  // If already owned, show success/download screen immediately
  const isUnlocked = hasPurchased || (isPremium && pack.free_for_premium !== false);

  if (showSuccessState || (isUnlocked && !loadingPurchase)) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.successWrapper}>
            <CheckCircle className={styles.successIcon} size={64} />
            <h1 className={styles.successTitle}>Pack Unlocked!</h1>
            <p className={styles.successDesc}>
              Thank you for your purchase. You now have full lifetime commercial license access to <strong>{pack.name}</strong>.
            </p>

            <div className={styles.successActions}>
              <button className={styles.downloadBtn} onClick={handleDownload}>
                <Download size={18} />
                <span>Download Pack (ZIP)</span>
              </button>
              <Link href={`/shop/${pack.slug}`} className={styles.detailLink}>
                Go to Pack Detail page & review
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const mainContent = (
    <div className={styles.container}>
      <Link href={`/shop/${pack.slug}`} className={styles.backLink}>
        <ArrowLeft size={16} />
        <span>Back to Pack Details</span>
      </Link>

      <h1 className={styles.title}>Checkout</h1>

      <div className={styles.layout}>
        {/* LEFT COLUMN: Payment Methods */}
        <div className={styles.mainPanel}>
          {!user ? (
            <div className={styles.card}>
              <div className={styles.authTabs}>
                <button
                  type="button"
                  className={`${styles.authTab} ${authMode === "login" ? styles.authTabActive : ""}`}
                  onClick={() => { setAuthMode("login"); setAuthError(""); setAuthSuccess(""); }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={`${styles.authTab} ${authMode === "signup" ? styles.authTabActive : ""}`}
                  onClick={() => { setAuthMode("signup"); setAuthError(""); setAuthSuccess(""); }}
                >
                  Create Account
                </button>
              </div>

              {authError && (
                <div className={styles.errorAlert}>
                  <AlertCircle size={16} />
                  <span>{authError}</span>
                </div>
              )}

              {authSuccess && (
                <div className={styles.successAlert}>
                  <CheckCircle size={16} />
                  <span>{authSuccess}</span>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className={styles.formGroup}>
                <div className={styles.inputControl}>
                  <span className={styles.inputLabel}>Email Address</span>
                  <div className={styles.inputFieldWrapper}>
                    <Mail className={styles.inputIcon} size={16} />
                    <input
                      type="email"
                      className={styles.inputField}
                      placeholder="you@example.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      disabled={authLoading}
                      required
                    />
                  </div>
                </div>

                <div className={styles.inputControl}>
                  <span className={styles.inputLabel}>Password</span>
                  <div className={styles.inputFieldWrapper}>
                    <Lock className={styles.inputIcon} size={16} />
                    <input
                      type={showPassword ? "text" : "password"}
                      className={styles.inputField}
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      disabled={authLoading}
                      required
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button type="submit" className={styles.submitBtn} disabled={authLoading}>
                  {authLoading ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : authMode === "login" ? (
                    "Sign In & Continue"
                  ) : (
                    "Create Account & Continue"
                  )}
                </button>
              </form>

              <div className={styles.divider}>Or Continue with</div>

              <button type="button" className={styles.googleBtn} onClick={handleGoogleAuth} disabled={authLoading}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.94 5.94 0 0 1 8 12.63c0-3.3 2.64-5.97 5.99-5.97 1.516 0 2.923.557 4.007 1.575l3.11-3.11A9.97 9.97 0 0 0 13.99 2c-5.523 0-10 4.477-10 10s4.477 10 10 10c5.772 0 10.02-4.056 10.02-10 0-.665-.058-1.32-.17-1.715H12.24Z" />
                </svg>
                <span>Google Account</span>
              </button>
            </div>
          ) : loadingPurchase ? (
            <div className={styles.card} style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : (
            <div className={styles.card}>
              <div style={{ marginBottom: "24px" }}>
                <span className={styles.inputLabel}>Account</span>
                <div className={styles.loggedInBox}>
                  <div className={styles.userIcon}>
                    <User size={18} />
                  </div>
                  <div className={styles.userInfo}>
                    <span className={styles.loggedInLabel}>Logged in as</span>
                    <span className={styles.loggedInEmail}>{user.email}</span>
                  </div>
                </div>
              </div>

              <h2 className={styles.cardTitle}>Payment Method</h2>
              
              <div className={styles.couponWrapper}>
                <span className={styles.couponLabel}>Coupon Code</span>
                <CouponInput packId={pack.id} onApply={setAppliedCoupon} disabled={isProcessing} />
              </div>

              {currentPrice <= 0 ? (
                <button
                  className={styles.downloadBtn}
                  onClick={handleClaimFree}
                  disabled={isProcessing}
                  style={{ width: "100%", maxWidth: "100%", marginTop: "16px" }}
                >
                  {isProcessing ? "Processing..." : "Claim Free Pack"}
                </button>
              ) : (
                <>
                  <div className={styles.divider}>Pay with PayPal</div>
                  
                  {paypalClientId ? (
                    <div className={styles.paypalContainer}>
                        <PayPalButtons
                          style={{
                            layout: "vertical",
                            color: paypalColor,
                            shape: "rect",
                            label: "checkout",
                            tagline: false,
                            height: 48,
                          }}
                          disabled={isProcessing}
                          forceReRender={[currentPrice, paypalColor]}
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
                    </div>
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
                </>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Order Summary */}
        <div className={styles.summaryPanel}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Order Summary</h2>
            
            <div className={styles.summaryPackInfo}>
              {pack.cover_image ? (
                <Image
                  src={pack.cover_image}
                  alt={pack.name}
                  width={80}
                  height={80}
                  className={styles.summaryCover}
                />
              ) : (
                <div className={styles.summaryCoverPlaceholder}>
                  <Package size={24} />
                </div>
              )}
              
              <div className={styles.summaryPackText}>
                <span className={styles.summaryCategory}>{pack.category || "Audio Pack"}</span>
                <h3 className={styles.summaryName}>{pack.name}</h3>
                <div className={styles.summaryMeta}>
                  <span>{pack.item_count || 0} items</span>
                  <span>{formattedSize}</span>
                </div>
              </div>
            </div>

            <div className={styles.priceRows}>
              {pack.original_price > pack.price && (
                <div className={styles.priceRow}>
                  <span>Original Price</span>
                  <span style={{ textDecoration: "line-through" }}>${pack.original_price.toFixed(2)}</span>
                </div>
              )}

              <div className={styles.priceRow}>
                <span>Subtotal</span>
                <span>${pack.price.toFixed(2)}</span>
              </div>
              
              {appliedCoupon && (
                <div className={`${styles.priceRow} ${styles.priceRowDiscount}`}>
                  <span>Discount ({appliedCoupon.code})</span>
                  <span>-${(pack.price - appliedCoupon.finalPrice).toFixed(2)}</span>
                </div>
              )}

              <div className={styles.totalRow}>
                <span>Total</span>
                <span>${currentPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (paypalClientId) {
    return (
      <PayPalScriptProvider
        options={{
          "client-id": paypalClientId,
          currency: "USD",
          intent: "capture",
          components: "buttons,card-fields",
        }}
      >
        {mainContent}
      </PayPalScriptProvider>
    );
  }

  return mainContent;
}
