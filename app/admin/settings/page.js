export default function AdminSettings() {
  return (
    <div style={{ maxWidth: 600, width: "100%", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "var(--space-6)" }}>Settings</h1>
      <div style={{
        padding: "var(--space-6)", background: "var(--bg-card)", border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "var(--space-4)"
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-secondary)" }}>Site Name</label>
          <input type="text" defaultValue="EditerLor" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-secondary)" }}>Tagline</label>
          <input type="text" defaultValue="Free Resources for Video Editors" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-secondary)" }}>SEO Description</label>
          <textarea rows={3} defaultValue="Download free sound effects, music, video memes, green screens, animations, overlays, fonts, and presets." />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-secondary)" }}>Contact Email</label>
          <input type="email" placeholder="admin@editerlor.com" />
        </div>
        <button style={{
          padding: "var(--space-3)", background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-purple))",
          color: "var(--bg-primary)", fontWeight: 600, fontSize: "0.95rem",
          border: "none", borderRadius: "var(--radius-md)", cursor: "pointer",
          marginTop: "var(--space-2)"
        }}>
          Save Settings
        </button>
      </div>
    </div>
  );
}
