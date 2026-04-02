"use client";

import { useAuth } from "@/app/lib/auth-context";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function AdminGuard({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && pathname !== "/admin/login") {
      router.replace("/admin/login");
    }
  }, [user, loading, pathname, router]);

  // Still loading auth state
  if (loading) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--bg-primary)",
        color: "var(--text-muted)",
        fontSize: "1rem",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 32, height: 32,
            border: "3px solid var(--border-default)",
            borderTopColor: "var(--neon-cyan)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 12px",
          }} />
          Verifying access...
        </div>
      </div>
    );
  }

  // Not logged in, on login page — just show login
  if (!user && pathname === "/admin/login") {
    return children;
  }

  // Not logged in, not on login page — redirect (handled by useEffect)
  if (!user) {
    return null;
  }

  // Logged in — show admin content
  return children;
}
