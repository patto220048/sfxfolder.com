"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Upload, FolderTree, Tags, Settings, LogOut, ExternalLink
} from "lucide-react";
import { useAuth } from "@/app/lib/auth-context";
import styles from "./AdminSidebar.module.css";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard" },
  { icon: Upload, label: "Resources", href: "/admin/resources" },
  { icon: FolderTree, label: "Folders", href: "/admin/folders" },
  { icon: Tags, label: "Tags", href: "/admin/tags" },
  { icon: Settings, label: "Settings", href: "/admin/settings" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push("/admin/login");
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <Link href="/admin/dashboard" className={styles.logo}>
          EditerLor
        </Link>
        <span className={styles.badge}>Admin</span>
      </div>

      <nav className={styles.nav}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.link} ${isActive ? styles.active : ""}`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.bottom}>
        {user && (
          <div className={styles.userInfo}>
            <span className={styles.userEmail}>{user.email}</span>
          </div>
        )}
        <Link href="/" className={styles.link}>
          <ExternalLink size={18} />
          <span>Back to Site</span>
        </Link>
        <button onClick={handleLogout} className={styles.logoutBtn}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
