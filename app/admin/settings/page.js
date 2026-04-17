"use client";

import { useState, useEffect } from "react";
import { getSiteSettings, updateSiteSettings } from "@/app/lib/api";
import { revalidateSettings } from "@/app/lib/actions";
import { uploadFile } from "@/app/lib/storage";
import { useToast } from "@/app/context/ToastContext";

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    site_name: "",
    tagline: "",
    project_version: "",
    contact_email: "",
    status_text: "",
    social_links: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const data = await getSiteSettings();
        if (data) {
          setSettings({
            ...data,
            social_links: data.social_links || []
          });
        }
      } catch (err) {
        // Error handled silently
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSiteSettings(settings);
      await revalidateSettings();
      showToast("Settings saved successfully!", "success");
    } catch (err) {
      showToast("Error: Failed to save settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleAddSocial = () => {
    setSettings(prev => ({
      ...prev,
      social_links: [...prev.social_links, { name: "", url: "", icon_url: "" }]
    }));
  };

  const handleRemoveSocial = (index) => {
    setSettings(prev => ({
      ...prev,
      social_links: prev.social_links.filter((_, i) => i !== index)
    }));
  };

  const handleSocialChange = (index, field, value) => {
    const newList = [...settings.social_links];
    newList[index][field] = value;
    setSettings(prev => ({ ...prev, social_links: newList }));
  };

  const handleIconUpload = async (index, file) => {
    if (!file) return;
    if (file.type !== "image/svg+xml") {
      alert("Chỉ chấp nhận file SVG");
      return;
    }

    try {
      const path = `social-icons/${Date.now()}-${file.name}`;
      const url = await uploadFile(file, path, 'site-assets');
      handleSocialChange(index, "icon_url", url);
    } catch (err) {
      console.error("Icon upload failed:", err);
      alert("Lỗi upload icon");
    }
  };

  if (loading) return <div style={{ padding: "var(--space-10)", textAlign: "center", color: "var(--text-secondary)" }}>Đang tải cấu hình...</div>;

  return (
    <div style={{ maxWidth: 800, width: "100%", margin: "0 auto", paddingBottom: "var(--space-20)" }}>
      <header style={{ marginBottom: "var(--space-8)", borderBottom: "2px solid var(--text-primary)", paddingBottom: "var(--space-4)" }}>
        <h1 style={{ fontSize: "2rem", textTransform: "uppercase", letterSpacing: "2px" }}>System Configuration</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Quản lý thông tin cơ bản và các liên kết mạng xã hội của dự án.</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "var(--space-10)" }}>
        {/* General Settings */}
        <section>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span style={{ width: 8, height: 8, background: "var(--neon-cyan)" }}></span>
            General Information
          </h2>
          <div style={{
            padding: "var(--space-6)", background: "var(--bg-card)", border: "1px solid var(--border-default)",
            display: "flex", flexDirection: "column", gap: "var(--space-4)"
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                <label style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)" }}>Site Name</label>
                <input 
                  type="text" name="site_name" value={settings.site_name} onChange={handleChange}
                  style={{ padding: "var(--space-2)", background: "black", border: "1px solid var(--border-default)", color: "white" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                <label style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)" }}>Project Version</label>
                <input 
                  type="text" name="project_version" value={settings.project_version} onChange={handleChange}
                  style={{ padding: "var(--space-2)", background: "black", border: "1px solid var(--border-default)", color: "var(--neon-cyan)", fontWeight: "bold" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <label style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)" }}>Tagline</label>
              <input 
                type="text" name="tagline" value={settings.tagline} onChange={handleChange}
                style={{ padding: "var(--space-2)", background: "black", border: "1px solid var(--border-default)", color: "white" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <label style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)" }}>System Status Text</label>
              <input 
                type="text" name="status_text" value={settings.status_text} onChange={handleChange}
                style={{ padding: "var(--space-2)", background: "black", border: "1px solid var(--border-default)", color: "white" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <label style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-secondary)" }}>Contact Email</label>
              <input 
                type="email" name="contact_email" value={settings.contact_email} onChange={handleChange}
                style={{ padding: "var(--space-2)", background: "black", border: "1px solid var(--border-default)", color: "white" }}
              />
            </div>
          </div>
        </section>

        {/* Social Media Links */}
        <section>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span style={{ width: 8, height: 8, background: "var(--neon-purple)" }}></span>
            Social Media Links
          </h2>
          <div style={{
            padding: "var(--space-6)", background: "var(--bg-card)", border: "1px solid var(--border-default)",
            display: "flex", flexDirection: "column", gap: "var(--space-4)"
          }}>
            {settings.social_links.map((social, index) => (
              <div key={index} style={{ 
                display: "grid", gridTemplateColumns: "150px 1fr 120px 40px", gap: "var(--space-3)", 
                paddingBottom: "var(--space-4)", borderBottom: "1px solid var(--bg-hover)", alignItems: "end"
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                  <label style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>NAME</label>
                  <input 
                    type="text" value={social.name} onChange={(e) => handleSocialChange(index, "name", e.target.value)}
                    placeholder="e.g. Youtube"
                    style={{ padding: "var(--space-2)", background: "black", border: "1px solid var(--border-default)", color: "white", fontSize: "0.85rem" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                  <label style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>URL</label>
                  <input 
                    type="text" value={social.url} onChange={(e) => handleSocialChange(index, "url", e.target.value)}
                    placeholder="https://..."
                    style={{ padding: "var(--space-2)", background: "black", border: "1px solid var(--border-default)", color: "white", fontSize: "0.85rem" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                  <label style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>ICON (SVG)</label>
                  <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                    <div style={{ 
                      width: 32, height: 32, background: "black", border: "1px solid var(--border-default)",
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      {social.icon_url ? <img src={social.icon_url} alt="icon" style={{ width: 20, height: 20 }} /> : <span style={{fontSize: 10, color: "#333"}}>UI</span>}
                    </div>
                    <label style={{ 
                      cursor: "pointer", padding: "4px 8px", background: "var(--bg-hover)", border: "1px solid var(--border-default)", fontSize: "0.7rem" 
                    }}>
                      UP
                      <input type="file" accept=".svg" onChange={(e) => handleIconUpload(index, e.target.files[0])} style={{ display: "none" }} />
                    </label>
                  </div>
                </div>
                <button 
                  onClick={() => handleRemoveSocial(index)}
                  style={{ background: "transparent", color: "#666", border: "none", cursor: "pointer", fontSize: "1.2rem", paddingBottom: 5 }}
                >
                  &times;
                </button>
              </div>
            ))}
            
            <button 
              onClick={handleAddSocial}
              style={{ padding: "var(--space-2)", background: "black", border: "1px dashed #333", color: "var(--text-secondary)", cursor: "pointer" }}
            >
              + Add New Social Link
            </button>
          </div>
        </section>

        {/* Action Bar */}
        <div style={{ 
          position: "sticky", 
          bottom: 20, 
          background: "rgba(0,0,0,0.8)", 
          backdropFilter: "blur(10px)",
          padding: "var(--space-6)", 
          border: "2px solid var(--text-primary)", 
          display: "flex", 
          justifyContent: "center",
          alignItems: "center",
          zIndex: 100,
          marginTop: "var(--space-10)"
        }}>
          <button 
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "var(--space-4) var(--space-12)", 
              background: saving ? "var(--bg-hover)" : "white",
              color: "black", 
              fontWeight: "900", 
              border: "2px solid black",
              cursor: saving ? "not-allowed" : "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              fontSize: "1rem",
              boxShadow: "4px 4px 0px black",
              transition: "all 0.15s cubic-bezier(0.23, 1, 0.32, 1)",
              transform: saving ? "translate(2px, 2px)" : "none"
            }}
          >
            {saving ? "SAVING..." : "SAVE ALL CHANGES"}
          </button>
        </div>
      </div>
    </div>
  );
}
