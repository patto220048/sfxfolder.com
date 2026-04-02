export default function AdminTags() {
  return (
    <div style={{ maxWidth: 600, width: "100%", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "var(--space-6)" }}>Tag Management</h1>
      <div style={{
        padding: "var(--space-8)", background: "var(--bg-card)", border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)", textAlign: "center", color: "var(--text-muted)"
      }}>
        <p>Tag management will be connected to Firebase.</p>
        <p style={{ marginTop: "var(--space-2)", fontSize: "0.85rem" }}>Add and remove tags used across resources.</p>
      </div>
    </div>
  );
}
