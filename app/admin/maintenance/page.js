"use client";

import { useState } from "react";
import { Wrench, ShieldCheck, Database, Trash2, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

export default function MaintenancePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleCleanup = async (dryRun = true) => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/cleanup/storage?dryRun=${dryRun}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cleanup failed");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-page">
      <div style={{ marginBottom: "var(--space-8)" }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", fontSize: "2rem" }}>
          <Wrench size={32} /> Bảo trì hệ thống
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>
          Các công cụ tối ưu hóa Database và Storage định kỳ.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "var(--space-6)" }}>
        
        {/* Section 1: Optimization Status */}
        <div style={{ background: "var(--bg-secondary)", padding: "var(--space-6)", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "1.25rem", marginBottom: "var(--space-4)" }}>
            <Database size={20} color="var(--accent-primary)" /> Hiệu năng Database
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", color: "var(--success)" }}>
              <CheckCircle2 size={16} /> <span>Các chỉ mục (Indexes) đã được thiết lập.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", color: "var(--success)" }}>
              <CheckCircle2 size={16} /> <span>Giới hạn tải xuống (200/ngày) đang hoạt động.</span>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              Database của bạn đang hoạt động ở trạng thái tối ưu nhất cho gói Free của Supabase.
            </p>
          </div>
        </div>

        {/* Section 2: Storage Cleanup */}
        <div style={{ background: "var(--bg-secondary)", padding: "var(--space-6)", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "1.25rem", marginBottom: "var(--space-4)" }}>
            <Trash2 size={20} color="#ff4d4f" /> Dọn dẹp Storage
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "var(--space-6)" }}>
            Quét và xóa các file &quot;mồ côi&quot; (file có trên Storage nhưng không có trong Database) để giải phóng dung lượng.
          </p>
          
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <button 
              onClick={() => handleCleanup(true)}
              disabled={loading}
              style={{ 
                flex: 1, 
                padding: "10px", 
                borderRadius: "8px", 
                border: "1px solid var(--border-color)", 
                background: "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px"
              }}
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
              Kiểm tra thử (Dry Run)
            </button>
            <button 
              onClick={() => {
                if(confirm("BẠN CÓ CHẮC CHẮN? Hành động này sẽ XÓA VĨNH VIỄN các file không dùng đến trên Storage.")) {
                  handleCleanup(false);
                }
              }}
              disabled={loading}
              style={{ 
                flex: 1, 
                padding: "10px", 
                borderRadius: "8px", 
                border: "none", 
                background: "#ff4d4f",
                color: "white",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px"
              }}
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
              Dọn dẹp thật sự
            </button>
          </div>

          {error && (
            <div style={{ marginTop: "var(--space-4)", padding: "var(--space-3)", background: "rgba(255, 77, 79, 0.1)", color: "#ff4d4f", borderRadius: "6px", fontSize: "0.875rem" }}>
              <AlertTriangle size={16} /> Lỗi: {error}
            </div>
          )}

          {result && (
            <div style={{ marginTop: "var(--space-4)", padding: "var(--space-4)", background: "var(--bg-primary)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
              <h3 style={{ fontSize: "1rem", marginBottom: "var(--space-2)" }}>Kết quả quét:</h3>
              <ul style={{ fontSize: "0.875rem", listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
                <li>Tổng số file quét: <strong>{result.totalFilesScanned}</strong></li>
                <li>Số file mồ côi phát hiện: <strong style={{ color: result.orphanedCount > 0 ? "#ff4d4f" : "var(--success)" }}>{result.orphanedCount}</strong></li>
                {result.dryRun === false && (
                  <li>Số file đã xóa: <strong style={{ color: "var(--success)" }}>{result.deletedCount}</strong></li>
                )}
              </ul>
              {result.orphanedFiles?.length > 0 && (
                <div style={{ marginTop: "var(--space-3)", maxHeight: "150px", overflowY: "auto", fontSize: "0.75rem", color: "var(--text-secondary)", borderTop: "1px solid var(--border-color)", paddingTop: "var(--space-2)" }}>
                  {result.orphanedFiles.map(f => <div key={f}>{f}</div>)}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      <style jsx>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
