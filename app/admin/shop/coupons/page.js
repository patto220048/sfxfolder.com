"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Ticket,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import toast from "react-hot-toast";
import styles from "./page.module.css";

export default function AdminCouponsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmCoupon, setDeleteConfirmCoupon] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    code: "",
    discount_type: "percent",
    discount_value: 0,
    min_purchase: 0,
    max_discount: "",
    valid_from: "",
    valid_until: "",
    max_uses: "",
    max_uses_per_user: 1,
    is_active: true,
    applicable_pack_ids: [],
  });

  // Fetch coupons
  const {
    data: coupons = [],
    isLoading: isCouponsLoading,
    mutate: mutateCoupons,
  } = useSWR("admin_coupons", async () => {
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load coupons: " + error.message);
      throw error;
    }
    return data;
  });

  // Fetch sound packs for coupon applicability list
  const { data: packs = [] } = useSWR("admin_coupon_packs", async () => {
    const { data, error } = await supabase
      .from("sound_packs")
      .select("id, name")
      .eq("status", "published");

    if (error) {
      console.error("Failed to load packs for coupons:", error);
      return [];
    }
    return data;
  });

  // Format date helper for datetime-local input fields (YYYY-MM-DDThh:mm)
  const formatDateForInput = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    return localISOTime;
  };

  const handleOpenAdd = () => {
    setEditingCoupon(null);
    setFormData({
      code: "",
      discount_type: "percent",
      discount_value: 0,
      min_purchase: 0,
      max_discount: "",
      valid_from: "",
      valid_until: "",
      max_uses: "",
      max_uses_per_user: 1,
      is_active: true,
      applicable_pack_ids: [],
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code || "",
      discount_type: coupon.discount_type || "percent",
      discount_value: coupon.discount_value || 0,
      min_purchase: coupon.min_purchase || 0,
      max_discount: coupon.max_discount || "",
      valid_from: coupon.valid_from ? formatDateForInput(coupon.valid_from) : "",
      valid_until: coupon.valid_until ? formatDateForInput(coupon.valid_until) : "",
      max_uses: coupon.max_uses !== null ? coupon.max_uses : "",
      max_uses_per_user: coupon.max_uses_per_user || 1,
      is_active: coupon.is_active !== false,
      applicable_pack_ids: coupon.applicable_pack_ids || [],
    });
    setModalOpen(true);
  };

  const handlePackSelection = (packId) => {
    setFormData((prev) => {
      const current = prev.applicable_pack_ids;
      if (current.includes(packId)) {
        return { ...prev, applicable_pack_ids: current.filter((id) => id !== packId) };
      } else {
        return { ...prev, applicable_pack_ids: [...current, packId] };
      }
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      toast.error("Coupon code is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: formData.code.toUpperCase().trim(),
        discount_type: formData.discount_type,
        discount_value: parseFloat(formData.discount_value) || 0,
        min_purchase: parseFloat(formData.min_purchase) || 0,
        max_discount: formData.max_discount ? parseFloat(formData.max_discount) : null,
        valid_from: formData.valid_from ? new Date(formData.valid_from).toISOString() : new Date().toISOString(),
        valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null,
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
        max_uses_per_user: parseInt(formData.max_uses_per_user) || 1,
        is_active: formData.is_active,
        applicable_pack_ids: formData.applicable_pack_ids.length > 0 ? formData.applicable_pack_ids : null,
      };

      if (editingCoupon) {
        // Update
        const { error } = await supabase
          .from("coupons")
          .update(payload)
          .eq("id", editingCoupon.id);

        if (error) throw error;
        toast.success("Coupon updated successfully");
      } else {
        // Insert
        const { error } = await supabase.from("coupons").insert(payload);
        if (error) throw error;
        toast.success("Coupon created successfully");
      }

      mutateCoupons();
      setModalOpen(false);
    } catch (err) {
      toast.error("Failed to save coupon: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmCoupon) return;
    try {
      const { error } = await supabase
        .from("coupons")
        .delete()
        .eq("id", deleteConfirmCoupon.id);

      if (error) throw error;
      toast.success("Coupon deleted successfully");
      mutateCoupons();
      setDeleteConfirmCoupon(null);
    } catch (err) {
      toast.error("Failed to delete coupon: " + err.message);
    }
  };

  const isExpired = (coupon) => {
    if (!coupon.valid_until) return false;
    return new Date() > new Date(coupon.valid_until);
  };

  return (
    <div className={styles.page}>
      {/* HEADER */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Coupons</h1>
          <p className={styles.subtitle}>
            Manage promotional codes, discounts, and purchase limitations.
          </p>
        </div>
        <button className={styles.addBtn} onClick={handleOpenAdd}>
          <Plus size={16} />
          <span>Create Coupon</span>
        </button>
      </header>

      {/* TABLE */}
      {isCouponsLoading ? (
        <div className={styles.loadingArea}>
          <Loader2 className={`${styles.spinner} animate-spin`} size={32} />
          <p>Loading coupons...</p>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Usage</th>
                <th>Limits</th>
                <th>Valid Period</th>
                <th>Status</th>
                <th style={{ width: "120px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => {
                const expired = isExpired(coupon);
                const active = coupon.is_active && !expired;
                return (
                  <tr key={coupon.id}>
                    <td>
                      <span className={styles.code}>{coupon.code}</span>
                    </td>
                    <td>
                      <span className={styles.discountValue}>
                        {coupon.discount_type === "percent"
                          ? `${coupon.discount_value}%`
                          : `$${coupon.discount_value}`}
                      </span>
                    </td>
                    <td>
                      <span className={styles.usage}>
                        {coupon.used_count || 0} /{" "}
                        {coupon.max_uses !== null ? coupon.max_uses : "∞"}
                      </span>
                    </td>
                    <td>
                      <span className={styles.usage}>
                        Min purchase: ${coupon.min_purchase || 0}
                        {coupon.max_discount && `, Max discount: $${coupon.max_discount}`}
                      </span>
                    </td>
                    <td>
                      <div className={styles.period}>
                        <span>
                          From:{" "}
                          {coupon.valid_from
                            ? new Date(coupon.valid_from).toLocaleDateString()
                            : "Immediate"}
                        </span>
                        <span>
                          Until:{" "}
                          {coupon.valid_until
                            ? new Date(coupon.valid_until).toLocaleDateString()
                            : "Permanent"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          expired
                            ? styles.expired
                            : coupon.is_active
                            ? styles.active
                            : styles.inactive
                        }`}
                      >
                        {expired ? "Expired" : coupon.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          className={styles.actionBtn}
                          onClick={() => handleOpenEdit(coupon)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className={styles.deleteBtn}
                          onClick={() => setDeleteConfirmCoupon(coupon)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {coupons.length === 0 && (
                <tr>
                  <td colSpan="7" className={styles.emptyRow}>
                    No coupons created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE/EDIT MODAL */}
      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingCoupon ? "Edit Coupon" : "Create Coupon"}
              </h2>
              <button className={styles.closeBtn} onClick={() => setModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className={styles.form}>
              <div className={styles.formGrid}>
                <div className={styles.inputGroup}>
                  <label>Coupon Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                    placeholder="SUMMER50"
                    required
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Discount Type</label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) =>
                      setFormData({ ...formData, discount_type: e.target.value })
                    }
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ($)</option>
                  </select>
                </div>

                <div className={styles.inputGroup}>
                  <label>Discount Value</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.discount_value}
                    onChange={(e) =>
                      setFormData({ ...formData, discount_value: e.target.value })
                    }
                    required
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Minimum Purchase ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.min_purchase}
                    onChange={(e) =>
                      setFormData({ ...formData, min_purchase: e.target.value })
                    }
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Max Discount Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.max_discount}
                    placeholder="e.g. 10"
                    onChange={(e) =>
                      setFormData({ ...formData, max_discount: e.target.value })
                    }
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Max Uses (Total)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.max_uses}
                    placeholder="e.g. 100"
                    onChange={(e) =>
                      setFormData({ ...formData, max_uses: e.target.value })
                    }
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Max Uses Per User</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.max_uses_per_user}
                    onChange={(e) =>
                      setFormData({ ...formData, max_uses_per_user: e.target.value })
                    }
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Valid From</label>
                  <input
                    type="datetime-local"
                    value={formData.valid_from}
                    onChange={(e) =>
                      setFormData({ ...formData, valid_from: e.target.value })
                    }
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Valid Until</label>
                  <input
                    type="datetime-local"
                    value={formData.valid_until}
                    onChange={(e) =>
                      setFormData({ ...formData, valid_until: e.target.value })
                    }
                  />
                </div>

                <div className={styles.inputGroup}>
                  <div className={styles.toggleRow} style={{ marginTop: "1rem" }}>
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      className={styles.toggle}
                      onChange={(e) =>
                        setFormData({ ...formData, is_active: e.target.checked })
                      }
                    />
                    <label htmlFor="is_active" className={styles.toggleLabel}>
                      Active Status
                    </label>
                  </div>
                </div>

                <div className={styles.inputGroupFull}>
                  <label>Applicable Packs (Select none for all packs)</label>
                  <div
                    style={{
                      maxHeight: "140px",
                      overflowY: "auto",
                      border: "1px solid var(--border-default)",
                      padding: "10px",
                      background: "var(--bg-surface)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {packs.map((pack) => {
                      const isSelected = formData.applicable_pack_ids.includes(pack.id);
                      return (
                        <label
                          key={pack.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "0.8rem",
                            cursor: "pointer",
                            textTransform: "none",
                            color: "var(--text-primary)",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handlePackSelection(pack.id)}
                            style={{ width: "14px", height: "14px" }}
                          />
                          <span>{pack.name}</span>
                        </label>
                      );
                    })}
                    {packs.length === 0 && (
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                        No published sound packs available.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.saveBtn} disabled={saving}>
                  {saving ? "Saving..." : "Save Coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteConfirmCoupon && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Delete Coupon</h3>
            <p className={styles.modalText}>
              Are you sure you want to delete the coupon &ldquo;{deleteConfirmCoupon.code}&rdquo;?
              This action cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setDeleteConfirmCoupon(null)}
              >
                Cancel
              </button>
              <button className={styles.dangerBtn} onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
