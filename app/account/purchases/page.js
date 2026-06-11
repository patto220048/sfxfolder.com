"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Crown, Download, Package, Loader2 } from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth-context";
import toast from "react-hot-toast";
import styles from "./page.module.css";

export default function UserPurchasesPage() {
  const { user, isPremium, loading: authLoading } = useAuth();
  const [loadingData, setLoadingData] = useState(true);
  const [purchasedPacks, setPurchasedPacks] = useState([]);
  const [premiumPacks, setPremiumPacks] = useState([]);

  // Fetch purchases & premium bundles
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoadingData(false);
      return;
    }

    async function loadLibrary() {
      setLoadingData(true);
      try {
        // 1. Fetch purchased packs
        const { data: purchases, error: purchaseError } = await supabase
          .from("pack_purchases")
          .select("*, pack:sound_packs(*)")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .order("purchased_at", { ascending: false });

        if (purchaseError) throw purchaseError;

        const formattedPurchases = purchases
          ?.map((p) => ({
            ...p.pack,
            purchased_at: p.purchased_at,
          }))
          .filter(Boolean) || [];

        setPurchasedPacks(formattedPurchases);

        // 2. If Premium, fetch all other published packs (which are free for premium)
        if (isPremium) {
          const { data: allPacks, error: packsError } = await supabase
            .from("sound_packs")
            .select("*")
            .eq("status", "published")
            .eq("free_for_premium", true)
            .order("name", { ascending: true });

          if (packsError) throw packsError;

          // Filter out packs that are already in purchased list
          const purchasedIds = formattedPurchases.map((p) => p.id);
          const otherPacks = allPacks?.filter((p) => !purchasedIds.includes(p.id)) || [];
          setPremiumPacks(otherPacks);
        }
      } catch (err) {
        toast.error("Failed to load your purchases library: " + err.message);
      } finally {
        setLoadingData(false);
      }
    }

    loadLibrary();
  }, [user, isPremium, authLoading]);

  // Handle pack ZIP download trigger
  const handleDownload = async (pack) => {
    const toastId = toast.loading(`Preparing download link for ${pack.name}...`);
    try {
      const res = await fetch("/api/shop/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: pack.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Download link generation failed");
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

  if (authLoading || loadingData) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingArea}>
          <Loader2 className={`${styles.spinner} animate-spin`} size={36} />
          <p>Loading your sound library...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Package size={48} style={{ color: "var(--text-muted)" }} />
          <h2 className={styles.emptyText}>Access Denied</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: 0 }}>
            Please log in to view your purchased sound packs.
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("need-auth"))}
            className={styles.emptyBtn}
            style={{ marginTop: "10px" }}
          >
            Log In
          </button>
        </div>
      </div>
    );
  }

  const hasAnyPacks = purchasedPacks.length > 0 || (isPremium && premiumPacks.length > 0);

  return (
    <div className={styles.container}>
      <header style={{ marginBottom: "2rem" }}>
        <h1 className={styles.title}>My Library</h1>
        <p className={styles.subtitle}>
          Access and download your purchased sound bundles and premium packages.
        </p>
      </header>

      {/* PREMIUM BENEFITS BANNER */}
      {isPremium && (
        <div className={styles.premiumBanner}>
          <div className={styles.premiumText}>
            <Crown size={18} />
            <span>
              As a Premium subscriber, you have unlimited access to download eligible
              sound packs for free!
            </span>
          </div>
          <Link href="/shop" className={styles.shopLink}>
            Browse Shop
          </Link>
        </div>
      )}

      {/* LIBRARY GRID */}
      {!hasAnyPacks ? (
        <div className={styles.emptyState}>
          <Package size={48} style={{ color: "var(--text-muted)" }} />
          <h2 className={styles.emptyText}>No Sound Packs Yet</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: 0 }}>
            You haven&apos;t purchased any sound packs. Explore the shop to get premium audio bundles!
          </p>
          <Link href="/shop" className={styles.emptyBtn} style={{ marginTop: "10px" }}>
            Browse Shop
          </Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {/* Purchased packs */}
          {purchasedPacks.map((pack) => (
            <div key={pack.id} className={styles.card}>
              {pack.cover_image ? (
                <img
                  src={pack.cover_image}
                  alt={pack.name}
                  className={styles.coverThumb}
                />
              ) : (
                <div className={styles.coverPlaceholder}>
                  <Package size={24} />
                </div>
              )}
              <div className={styles.cardDetails}>
                <h3 className={styles.packName}>{pack.name}</h3>
                <span className={styles.date}>
                  Purchased: {new Date(pack.purchased_at).toLocaleDateString()}
                </span>
              </div>
              <button
                className={styles.downloadBtn}
                onClick={() => handleDownload(pack)}
                title="Download Bundle (ZIP)"
              >
                <Download size={18} />
              </button>
            </div>
          ))}

          {/* Premium-available packs (only shown if user is premium) */}
          {isPremium &&
            premiumPacks.map((pack) => (
              <div key={pack.id} className={styles.card} style={{ border: "1px solid rgba(250, 203, 17, 0.3)" }}>
                {pack.cover_image ? (
                  <img
                    src={pack.cover_image}
                    alt={pack.name}
                    className={styles.coverThumb}
                  />
                ) : (
                  <div className={styles.coverPlaceholder}>
                    <Package size={24} />
                  </div>
                )}
                <div className={styles.cardDetails}>
                  <h3 className={styles.packName}>{pack.name}</h3>
                  <span className={styles.date} style={{ color: "var(--premium-gold)", fontWeight: 700 }}>
                    Unlocked with Premium
                  </span>
                </div>
                <button
                  className={styles.downloadBtn}
                  style={{ color: "var(--premium-gold)", borderColor: "rgba(250, 203, 17, 0.3)" }}
                  onClick={() => handleDownload(pack)}
                  title="Download Free Bundle (ZIP)"
                >
                  <Download size={18} />
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
