"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ShoppingBag,
  DollarSign,
  Package,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth-context";
import toast from "react-hot-toast";
import styles from "./page.module.css";

export default function AdminShopPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [statusFilter, setStatusFilter] = useState("all");
  const [packToDelete, setPackToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch packs directly from Supabase
  const {
    data: packs = [],
    error: packsError,
    isLoading: isPacksLoading,
    mutate: mutatePacks,
  } = useSWR("admin_sound_packs", async () => {
    const { data, error } = await supabase
      .from("sound_packs")
      .select("*, category:categories(name)")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load sound packs: " + error.message);
      throw error;
    }
    return data;
  });

  // Fetch stats (Total revenue from pack_purchases)
  const {
    data: stats = { totalRevenue: 0, totalPurchases: 0 },
    isLoading: isStatsLoading,
  } = useSWR("admin_shop_stats", async () => {
    // Count and sum purchases
    const { data, error } = await supabase
      .from("pack_purchases")
      .select("amount_paid, status")
      .eq("status", "completed");

    if (error) {
      console.error("Failed to load shop stats:", error);
      return { totalRevenue: 0, totalPurchases: 0 };
    }

    const totalRevenue = data.reduce((sum, p) => sum + parseFloat(p.amount_paid || 0), 0);
    const totalPurchases = data.length;

    return { totalRevenue, totalPurchases };
  });

  // Handle delete pack
  const handleDeletePack = async () => {
    if (!packToDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("sound_packs")
        .delete()
        .eq("id", packToDelete.id);

      if (error) throw error;

      toast.success(`Deleted pack "${packToDelete.name}" successfully`);
      mutatePacks(packs.filter((p) => p.id !== packToDelete.id), false);
      setPackToDelete(null);
    } catch (err) {
      toast.error("Failed to delete pack: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter packs
  const filteredPacks = packs.filter((pack) => {
    if (statusFilter === "all") return true;
    return pack.status === statusFilter;
  });

  // Count helper for tabs
  const getTabCount = (status) => {
    if (status === "all") return packs.length;
    return packs.filter((p) => p.status === status).length;
  };

  return (
    <div className={styles.page}>
      {/* HEADER SECTION */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Sound Packs</h1>
          <p className={styles.subtitle}>
            Manage sound bundles, view sales statistics, and configure shop products.
          </p>
        </div>
        <button
          onClick={() => router.push("/admin/shop/new")}
          className={styles.addBtn}
        >
          <Plus size={16} />
          <span>Create Pack</span>
        </button>
      </header>

      {/* STATS SUMMARY */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Packs</span>
          <span className={styles.statValue}>
            {isPacksLoading ? (
              <Loader2 className={`${styles.spinner} animate-spin`} size={20} />
            ) : (
              packs.length
            )}
          </span>
        </div>
        <div className={`${styles.statCard} ${styles.statCardGold}`}>
          <span className={styles.statLabel}>Total Revenue</span>
          <span className={styles.statValue}>
            {isStatsLoading ? (
              <Loader2 className={`${styles.spinner} animate-spin`} size={20} />
            ) : (
              `$${stats.totalRevenue.toFixed(2)}`
            )}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Sales</span>
          <span className={styles.statValue}>
            {isStatsLoading ? (
              <Loader2 className={`${styles.spinner} animate-spin`} size={20} />
            ) : (
              stats.totalPurchases
            )}
          </span>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className={styles.filterTabs}>
        <button
          className={`${styles.filterTab} ${statusFilter === "all" ? styles.filterTabActive : ""}`}
          onClick={() => setStatusFilter("all")}
        >
          <span>All</span>
          <span className={styles.tabCount}>({getTabCount("all")})</span>
        </button>
        <button
          className={`${styles.filterTab} ${statusFilter === "published" ? styles.filterTabActive : ""}`}
          onClick={() => setStatusFilter("published")}
        >
          <span>Published</span>
          <span className={styles.tabCount}>({getTabCount("published")})</span>
        </button>
        <button
          className={`${styles.filterTab} ${statusFilter === "draft" ? styles.filterTabActive : ""}`}
          onClick={() => setStatusFilter("draft")}
        >
          <span>Draft</span>
          <span className={styles.tabCount}>({getTabCount("draft")})</span>
        </button>
        <button
          className={`${styles.filterTab} ${statusFilter === "archived" ? styles.filterTabActive : ""}`}
          onClick={() => setStatusFilter("archived")}
        >
          <span>Archived</span>
          <span className={styles.tabCount}>({getTabCount("archived")})</span>
        </button>
      </div>

      {/* PACKS TABLE */}
      {isPacksLoading ? (
        <div className={styles.loadingArea}>
          <Loader2 className={`${styles.spinner} animate-spin`} size={32} />
          <p>Loading sound packs...</p>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Cover</th>
                <th>Name</th>
                <th>Price</th>
                <th>Items</th>
                <th>Purchases</th>
                <th>Status</th>
                <th style={{ width: "120px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPacks.map((pack) => (
                <tr
                  key={pack.id}
                  className={styles.tableRow}
                  onClick={() => router.push(`/admin/shop/${pack.id}`)}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    {pack.cover_image ? (
                      <img
                        src={pack.cover_image}
                        alt={pack.name}
                        className={styles.coverThumb}
                      />
                    ) : (
                      <div className={styles.coverPlaceholder}>
                        <Package size={16} />
                      </div>
                    )}
                  </td>
                  <td>
                    <div className={styles.nameCell}>
                      <span className={styles.packName}>{pack.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className={styles.price}>
                      {pack.price > 0 ? `$${pack.price}` : "Free"}
                    </span>
                  </td>
                  <td>{pack.item_count || 0} items</td>
                  <td>{pack.purchase_count || 0}</td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${
                        pack.status === "published"
                          ? styles.published
                          : pack.status === "draft"
                          ? styles.draft
                          : styles.archived
                      }`}
                    >
                      {pack.status}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className={styles.actions}>
                      <button
                        className={styles.actionBtn}
                        onClick={() => router.push(`/admin/shop/${pack.id}`)}
                        title="Edit Pack"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => setPackToDelete(pack)}
                        title="Delete Pack"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPacks.length === 0 && (
                <tr>
                  <td colSpan="7" className={styles.emptyRow}>
                    No sound packs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {packToDelete && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Delete Sound Pack</h3>
            <p className={styles.modalText}>
              Are you sure you want to delete the sound pack &ldquo;{packToDelete.name}&rdquo;?
              This action cannot be undone and will delete all references to its items.
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setPackToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className={styles.dangerBtn}
                onClick={handleDeletePack}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
