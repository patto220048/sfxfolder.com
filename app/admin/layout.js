"use client";

import { AuthProvider } from "@/app/lib/auth-context";
import AdminGuard from "@/app/components/admin/AdminGuard";
import AdminSidebar from "@/app/components/admin/AdminSidebar";
import { useAuth } from "@/app/lib/auth-context";
import { usePathname } from "next/navigation";

function AdminContent({ children }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";

  // On login page, don't show sidebar
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Logged in — show sidebar + content
  return (
    <div style={{ display: "flex" }}>
      <AdminSidebar />
      <main style={{ flex: 1, padding: "var(--space-6)", minHeight: "100vh", background: "var(--bg-primary)" }}>
        {children}
      </main>
    </div>
  );
}

export default function AdminLayout({ children }) {
  return (
    <AuthProvider>
      <AdminGuard>
        <AdminContent>{children}</AdminContent>
      </AdminGuard>
    </AuthProvider>
  );
}
