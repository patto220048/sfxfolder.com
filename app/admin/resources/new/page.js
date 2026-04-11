"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function LegacyNewResource() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the unified resources page where the new upload workflow exists
    router.replace("/admin/resources");
  }, [router]);

  return (
    <div style={{ 
      height: "100vh", 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      justifyContent: "center",
      background: "#0a0f14",
      color: "#fff",
      gap: "20px",
      fontFamily: "Inter, sans-serif"
    }}>
      <Loader2 className="animate-spin" size={48} color="#00ffff" />
      <p style={{ fontSize: "1.1rem", opacity: 0.8 }}>Đang chuyển hướng đến trang quản lý tài nguyên mới...</p>
    </div>
  );
}

