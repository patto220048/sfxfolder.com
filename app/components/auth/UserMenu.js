"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/app/lib/auth-context";
import { LogOut, Crown, Settings, User } from "lucide-react";
import styles from "./UserMenu.module.css";

export default function UserMenu() {
  const { user, profile, isAdmin, isPremium, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!user) return null;

  const displayName =
    profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const avatarUrl =
    profile?.avatar_url || user?.user_metadata?.avatar_url || null;
  const initials = displayName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    setOpen(false);
    try {
      await logout();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  return (
    <div className={styles.container} ref={menuRef}>
      <button
        className={styles.trigger}
        onClick={() => setOpen(!open)}
        aria-label="User menu"
        aria-expanded={open}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className={styles.avatar}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className={styles.avatarFallback}>{initials}</div>
        )}
        {isPremium && (
          <span className={styles.premiumBadge}>
            <Crown size={10} />
          </span>
        )}
      </button>

      {open && (
        <div className={styles.dropdown}>
          {/* User info */}
          <div className={styles.userInfo}>
            <span className={styles.userName}>{displayName}</span>
            <span className={styles.userEmail}>{user.email}</span>
            {isPremium && (
              <span className={styles.premiumTag}>
                <Crown size={12} /> Premium
              </span>
            )}
            {isAdmin && (
              <span className={styles.adminTag}>Admin</span>
            )}
          </div>

          <div className={styles.divider} />

          {/* Menu items */}
          {isAdmin && (
            <a href="/admin/dashboard" className={styles.menuItem}>
              <Settings size={16} />
              <span>Admin Panel</span>
            </a>
          )}

          {!isPremium && (
            <a href="/pricing" className={styles.menuItem + " " + styles.upgradeItem}>
              <Crown size={16} />
              <span>Upgrade to Premium</span>
            </a>
          )}

          {isPremium && (
            <a href="/account/subscription" className={styles.menuItem}>
              <Crown size={16} />
              <span>Manage Subscription</span>
            </a>
          )}

          <div className={styles.divider} />

          <button className={styles.menuItem} onClick={handleLogout}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
