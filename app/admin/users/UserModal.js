"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import styles from "./page.module.css";

export default function UserModal({ user, onClose, onSuccess }) {
  const isEdit = !!user;
  const [formData, setFormData] = useState({
    email: user?.email || "",
    password: "",
    full_name: user?.full_name || "",
    role: user?.role || "user",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const endpoint = isEdit ? `/api/admin/users/${user.id}` : "/api/admin/users";
    const method = isEdit ? "PATCH" : "POST";

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save user");

      toast.success(isEdit ? "User updated" : "User created");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalTitle}>
          {isEdit ? "Edit User" : "Add New User"}
        </div>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Email Address</label>
            <input
              type="email"
              required
              disabled={isEdit || loading}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="user@example.com"
            />
          </div>

          {!isEdit && (
            <div className={styles.field}>
              <label>Password</label>
              <input
                type="password"
                required={!isEdit}
                disabled={loading}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Min 6 characters"
                minLength={6}
              />
            </div>
          )}

          <div className={styles.field}>
            <label>Full Name</label>
            <input
              type="text"
              required
              disabled={loading}
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="John Doe"
            />
          </div>

          <div className={styles.field}>
            <label>Role</label>
            <select
              value={formData.role}
              disabled={loading}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <option value="user">User</option>
              <option value="premium">Premium</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={loading}
            >
              {loading ? (
                <div className={styles.moreSpinner}>
                  <Loader2 size={18} className={styles.spin} />
                </div>
              ) : (
                isEdit ? "Save Changes" : "Create User"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
