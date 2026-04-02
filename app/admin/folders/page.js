export default function AdminFolders() {
  return (
    <div style={{ maxWidth: 800, width: "100%", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "var(--space-6)" }}>Folder Management</h1>
      <div style={{
        padding: "var(--space-8)", background: "var(--bg-card)", border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)", textAlign: "center", color: "var(--text-muted)"
      }}>
        <p>Folder tree management will be connected to Firebase.</p>
        <p style={{ marginTop: "var(--space-2)", fontSize: "0.85rem" }}>
          Create, edit, delete, and reorder folders for each category.
        </p>
      </div>
    </div>
  );
}
