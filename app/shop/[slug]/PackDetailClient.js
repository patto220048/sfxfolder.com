"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  Package,
  Download,
  Crown,
  CheckCircle,
  Database,
  Info,
  Star,
} from "lucide-react";
import { marked } from "marked";
import toast from "react-hot-toast";
import useSWR from "swr";
import { useAuth } from "@/app/lib/auth-context";
import { supabase } from "@/app/lib/supabase";
import PackItemList from "../components/PackItemList";
import styles from "./page.module.css";

export default function PackDetailClient({
  pack,
  initialItems,
  initialHasPurchased,
  paypalClientId,
  paypalMode,
}) {
  const { user, isPremium, isAdmin } = useAuth();
  const { resolvedTheme } = useTheme();

  const [hasPurchased, setHasPurchased] = useState(initialHasPurchased);
  const [showSuccessState, setShowSuccessState] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [viewCount, setViewCount] = useState(pack.view_count || 0);

  useEffect(() => {
    async function incrementView() {
      try {
        const { error } = await supabase.rpc("increment_pack_view_count", { p_pack_id: pack.id });
        if (!error) {
          setViewCount((prev) => prev + 1);
        }
      } catch (e) {
        console.error("Failed to increment pack view count:", e);
      }
    }
    incrementView();
  }, [pack.id]);

  // Fetch user purchase status client-side to allow SSG/ISR static pre-rendering
  useEffect(() => {
    if (user && !initialHasPurchased) {
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
          console.error("Client: Failed to fetch purchase status:", e);
        }
      }
      checkPurchase();
    }
  }, [user, pack.id, initialHasPurchased]);

  // Reviews fetching
  const { data: reviewsData, mutate: mutateReviews } = useSWR(
    `/api/shop/packs/${pack.id}/reviews`,
    async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch reviews");
      return res.json();
    }
  );
  const reviews = reviewsData?.reviews || [];

  // Review form state
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [hoverRating, setHoverRating] = useState(0);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isEditingReview, setIsEditingReview] = useState(false);

  // Check if user has access to write a review
  const hasAccess = hasPurchased || (isPremium && pack.free_for_premium !== false);
  const myReview = user ? reviews.find((r) => r.userId === user.id) : null;

  // Initialize review form when editing or myReview changes
  useEffect(() => {
    if (myReview && isEditingReview) {
      setReviewRating(myReview.rating);
      setReviewComment(myReview.comment || "");
    } else if (!myReview) {
      setReviewRating(0);
      setReviewComment("");
      setIsEditingReview(false);
    }
  }, [myReview, isEditingReview]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (reviewRating < 1 || reviewRating > 5) {
      toast.error("Please select a rating between 1 and 5 stars");
      return;
    }

    setIsSubmittingReview(true);
    const toastId = toast.loading("Saving your review...");

    try {
      const res = await fetch(`/api/shop/packs/${pack.id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save review");
      }

      toast.success("Review saved successfully!", { id: toastId });
      mutateReviews();
      setIsEditingReview(false);
    } catch (err) {
      toast.error(err.message || "Failed to save review", { id: toastId });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleDeleteReview = async (targetUserId) => {
    if (!window.confirm("Are you sure you want to delete this review?")) return;

    const toastId = toast.loading("Deleting review...");
    try {
      const res = await fetch(`/api/shop/packs/${pack.id}/reviews`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete review");
      }

      toast.success("Review deleted successfully!", { id: toastId });
      mutateReviews();
      if (targetUserId === user?.id) {
        setReviewRating(0);
        setReviewComment("");
        setIsEditingReview(false);
      }
    } catch (err) {
      toast.error(err.message || "Failed to delete review", { id: toastId });
    }
  };

  // Rating distribution calculations
  const mockCount = pack.mock_review_count || 0;
  const mockAvg = pack.mock_average_rating || 0;
  const realCount = reviews.length;
  const realSum = reviews.reduce((acc, curr) => acc + curr.rating, 0);

  const totalReviewsCount = realCount + mockCount;
  const ratingAvg = totalReviewsCount > 0
    ? (((mockAvg * mockCount) + realSum) / totalReviewsCount).toFixed(1)
    : "0.0";

  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  
  // 1. Add real reviews to distribution
  reviews.forEach((r) => {
    if (distribution[r.rating] !== undefined) {
      distribution[r.rating]++;
    }
  });

  // 2. Add mock reviews to distribution mathematically based on mock average
  if (mockCount > 0 && mockAvg > 0) {
    const rVal = Math.min(5, Math.max(1, mockAvg)); // clamp to 1-5
    const lower = Math.floor(rVal);
    const upper = Math.ceil(rVal);
    if (lower === upper) {
      distribution[lower] += mockCount;
    } else {
      const upperPct = rVal - lower;
      const upperCount = Math.round(mockCount * upperPct);
      const lowerCount = mockCount - upperCount;
      distribution[upper] += upperCount;
      distribution[lower] += lowerCount;
    }
  }

  const getPercentage = (count) => {
    if (totalReviewsCount === 0) return 0;
    return Math.round((count / totalReviewsCount) * 100);
  };

  const renderStars = (ratingValue, size = 16) => {
    return (
      <div style={{ display: "flex", gap: "2px" }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            size={size}
            fill={s <= ratingValue ? "var(--premium-gold, #FACB11)" : "none"}
            color={s <= ratingValue ? "var(--premium-gold, #FACB11)" : "var(--text-muted, #666)"}
          />
        ))}
      </div>
    );
  };

  const paypalColor = resolvedTheme === "dark" ? "white" : "black";

  // Calculate prices
  const currentPrice = pack.price;
  const isDiscounted = pack.original_price > pack.price;
  const originalDisplayPrice = pack.original_price;

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

  // Handle claim free pack
  const handleClaimFree = async () => {
    setIsProcessing(true);
    const toastId = toast.loading("Processing free pack claim...");
    try {
      const res = await fetch("/api/shop/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packId: pack.id,
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

    // Redirect to checkout page
    return (
      <Link href={`/shop/checkout?packId=${pack.id}`} className={styles.downloadBtn}>
        <span>Buy Now</span>
      </Link>
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
            <Image
              src={pack.cover_image}
              alt={pack.name}
              width={500}
              height={500}
              priority={true}
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
            <span>• {pack.purchase_count || 0} purchases</span>
            <span>• {viewCount} views</span>
          </div>

          {totalReviewsCount > 0 ? (
            <a href="#reviews" className={styles.ratingLink} style={{ marginBottom: "12px", display: "inline-flex" }}>
              {renderStars(parseFloat(ratingAvg), 16)}
              <span style={{ marginLeft: "4px" }}>{ratingAvg} ({totalReviewsCount} {totalReviewsCount === 1 ? "review" : "reviews"})</span>
            </a>
          ) : (
            <a href="#reviews" className={styles.ratingLink} style={{ marginBottom: "12px", display: "inline-flex", opacity: 0.6 }}>
              {renderStars(0, 16)}
              <span style={{ marginLeft: "4px" }}>No reviews yet</span>
            </a>
          )}

          <div className={styles.priceSection}>
            {currentPrice > 0 ? (
              <>
                {isDiscounted && originalDisplayPrice && (
                  <span className={styles.originalPrice}>
                    ${originalDisplayPrice}
                  </span>
                )}
                <span className={styles.price}>${currentPrice.toFixed(2)}</span>

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

      {/* REVIEWS SECTION */}
      <section id="reviews" className={styles.detailsSection} style={{ marginTop: "40px" }}>
        <h2 className={styles.sectionTitle}>Reviews &amp; Ratings</h2>

        {/* Summary Grid */}
        <div className={styles.reviewSummaryContainer}>
          <div className={styles.averageScoreColumn}>
            <span className={styles.largeScore}>{ratingAvg}</span>
            <span className={styles.scoreOutOf}>out of 5 stars</span>
            {renderStars(parseFloat(ratingAvg), 20)}
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "8px" }}>
              {totalReviewsCount} {totalReviewsCount === 1 ? "rating" : "ratings"}
            </span>
          </div>

          <div className={styles.starDistribution}>
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = distribution[stars];
              const pct = getPercentage(count);
              return (
                <div key={stars} className={styles.distributionRow}>
                  <span className={styles.starLabel}>{stars} star</span>
                  <div className={styles.barWrapper}>
                    <div className={styles.barFill} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={styles.percentageLabel}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Review Form (if user has access and hasn't reviewed yet, or is editing) */}
        {user && hasAccess && (!myReview || isEditingReview) && (
          <div className={styles.reviewFormContainer}>
            <h3 className={styles.reviewFormTitle}>
              {isEditingReview ? "Edit Your Review" : "Write a Review"}
            </h3>
            <form onSubmit={handleSubmitReview}>
              <div className={styles.formGroup}>
                <span className={styles.formLabel}>Your Rating</span>
                <div style={{ display: "flex", gap: "6px", margin: "8px 0" }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={28}
                      onClick={() => setReviewRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      style={{ cursor: "pointer" }}
                      fill={star <= (hoverRating || reviewRating) ? "var(--premium-gold, #FACB11)" : "none"}
                      color={star <= (hoverRating || reviewRating) ? "var(--premium-gold, #FACB11)" : "var(--text-muted, #666)"}
                    />
                  ))}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="review-comment">
                  Your Review (Optional)
                </label>
                <textarea
                  id="review-comment"
                  className={styles.reviewTextArea}
                  placeholder="Share your thoughts about this sound pack..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  type="submit"
                  className={styles.submitReviewBtn}
                  disabled={isSubmittingReview || reviewRating === 0}
                >
                  {isSubmittingReview ? "Submitting..." : "Submit Review"}
                </button>
                {isEditingReview && (
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => setIsEditingReview(false)}
                    style={{ border: "1px solid var(--border-default)", padding: "10px 20px" }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Prompt to purchase if logged in but no access */}
        {user && !hasAccess && (
          <div style={{ padding: "16px", border: "1px dashed var(--border-default)", textAlign: "center", marginBottom: "24px", color: "var(--text-muted)", fontSize: "0.9rem" }}>
            <Info size={16} style={{ verticalAlign: "middle", marginRight: "8px" }} />
            You must purchase or unlock this pack to write a review.
          </div>
        )}

        {/* Prompt to log in */}
        {!user && (
          <div style={{ padding: "16px", border: "1px dashed var(--border-default)", textAlign: "center", marginBottom: "24px", color: "var(--text-muted)", fontSize: "0.9rem" }}>
            <Info size={16} style={{ verticalAlign: "middle", marginRight: "8px" }} />
            Please <span style={{ color: "var(--text-primary)", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }} onClick={handleLoginRequest}>log in</span> to write a review.
          </div>
        )}

        {/* Reviews List */}
        <div className={styles.reviewsList}>
          {reviews.length === 0 ? (
            <div className={styles.noReviews}>No reviews for this pack yet. Be the first to review!</div>
          ) : (
            reviews.map((rev) => {
              const isMyRev = user && rev.userId === user.id;
              return (
                <div key={rev.id} className={styles.reviewCard}>
                  {isMyRev && <span className={styles.yourReviewBadge}>Your Review</span>}
                  
                  <div className={styles.reviewHeader}>
                    <div className={styles.reviewerInfo}>
                      {rev.reviewer.avatarUrl ? (
                        <img
                          src={rev.reviewer.avatarUrl}
                          alt={rev.reviewer.name}
                          className={styles.reviewerAvatar}
                        />
                      ) : (
                        <div className={styles.reviewerAvatarPlaceholder}>
                          {rev.reviewer.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className={styles.reviewerName}>{rev.reviewer.name}</div>
                        <div className={styles.reviewDate}>
                          {new Date(rev.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </div>
                      </div>
                    </div>

                    <div>{renderStars(rev.rating, 16)}</div>
                  </div>

                  {rev.comment && <p className={styles.reviewContent}>{rev.comment}</p>}

                  {/* Actions for owner or admin */}
                  {(isMyRev || isAdmin) && (
                    <div className={styles.reviewActions}>
                      {isMyRev && !isEditingReview && (
                        <button
                          className={styles.actionBtn}
                          onClick={() => setIsEditingReview(true)}
                        >
                          Edit
                        </button>
                      )}
                      <button
                        className={`${styles.actionBtn} ${styles.deleteBtn}`}
                        onClick={() => handleDeleteReview(rev.userId)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
