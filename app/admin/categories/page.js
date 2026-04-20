"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  X, 
  Loader2, 
  AlertTriangle,
} from "lucide-react";
import { 
  addCategory, 
  updateCategory, 
  deleteCategory 
} from "@/app/lib/api";
import { revalidateCategoryData } from "@/app/lib/actions";
import { ICON_LIST, getIcon } from "@/app/components/ui/IconLib";
import styles from "./page.module.css";

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function CategoriesPage() {
  const { data: categories = [], isLoading: loading, mutate } = useSWR("/api/admin/categories", fetcher);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    order: 0,
    description: "",
    layout: "media",
    color: "#FFFFFF",
    icon: "box",
    formats: []
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const openAddModal = () => {
    setEditingCategory(null);
    setFormData({ 
      name: "", 
      slug: "", 
      order: categories.length, 
      description: "",
      layout: "media",
      color: "#FFFFFF",
      icon: "box",
      formats: []
    });
    setError("");
    setModalOpen(true);
  };

  const openEditModal = (cat) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name || "",
      slug: cat.slug || "",
      order: cat.order || 0,
      description: cat.description || "",
      layout: cat.layout || "media",
      color: cat.color || "#FFFFFF",
      icon: cat.icon || "box",
      formats: cat.formats || []
    });
    setError("");
    setModalOpen(true);
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setFormData(prev => ({
      ...prev,
      name: val,
      // Auto-slug if not editing or if slug was auto-generated
      slug: !editingCategory ? val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : prev.slug
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const dataToSubmit = {
        ...formData,
        order: parseInt(formData.order) || 0
      };

      if (editingCategory) {
        await updateCategory(editingCategory.id, dataToSubmit);
      } else {
        await addCategory(dataToSubmit);
      }
      
      // 1. Invalidate server tags
      await revalidateCategoryData();
      
      // 2. Trigger SWR re-fetch
      await mutate();
      
      setModalOpen(false);
    } catch (err) {
      setError(err.message || "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat) => {
    if (cat.resourceCount > 0) {
      alert(`Không thể xóa Danh mục "${cat.name}" vì nó chứa ${cat.resourceCount} tài nguyên.`);
      return;
    }

    if (confirm(`Bạn có chắc chắn muốn xóa Danh mục "${cat.name}"?`)) {
      setSaving(true); // Reuse saving state for global loading during delete
      try {
        await deleteCategory(cat.id);
        await revalidateCategoryData();
        await mutate();
      } catch (err) {
        alert(err.message);
      } finally {
        setSaving(false);
      }
    }
  };

  if (loading && categories.length === 0) {
    return (
      <div className={styles.loadingArea}>
        <Loader2 className="animate-spin" />
        <p>Loading categories...</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Manage Categories</h1>
        <button onClick={openAddModal} className={styles.addBtn}>
          <Plus size={18} />
          Add Category
        </button>
      </header>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '80px' }}>Order</th>
              <th>Category Name</th>
              <th>Slug</th>
              <th>Layout</th>
              <th>Formats</th>
              <th>Resources</th>
              <th style={{ width: '120px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id}>
                <td>
                  <span className={styles.orderBadge}>{cat.order}</span>
                </td>
                <td>
                  <div className={styles.categoryNameCell}>
                    <div 
                      className={styles.colorIndicator} 
                      style={{ backgroundColor: cat.color || '#FFFFFF' }} 
                    />
                    {(() => {
                      const CategoryIcon = getIcon(cat.icon);
                      return <CategoryIcon size={16} className={styles.tableIcon} style={{ color: cat.color }} />;
                    })()}
                    <strong>{cat.name}</strong>
                  </div>
                </td>
                <td><code>{cat.slug}</code></td>
                <td>
                  <span className={`${styles.typeBadge} ${styles[cat.layout || 'media']}`}>
                    {cat.layout || 'media'}
                  </span>
                </td>
                <td>
                  <div className={styles.formatList}>
                    {(cat.formats || []).map(f => (
                      <span key={f} className={styles.formatTag}>{f}</span>
                    ))}
                    {(!cat.formats || cat.formats.length === 0) && "—"}
                  </div>
                </td>
                <td>
                  <span className={styles.countBadge}>{cat.resourceCount} items</span>
                </td>
                <td>
                  <div className={styles.actions}>
                    <button 
                      className={styles.actionBtn} 
                      onClick={() => openEditModal(cat)}
                      title="Edit Category"
                    >
                      <Pencil size={16} />
                    </button>
                    <a 
                      href={`/admin/resources?category=${cat.slug}`}
                      className={styles.actionBtn}
                      title="View Resources"
                    >
                      <Plus size={16} />
                    </a>
                    <button 
                      className={styles.deleteBtn} 
                      onClick={() => handleDelete(cat)}
                      title="Delete Category"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                  No categories found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingCategory ? "Edit Category" : "New Category"}
              </h2>
              <button className={styles.closeBtn} onClick={() => setModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGrid}>
                <div className={styles.inputGroup}>
                  <label>Name</label>
                  <input 
                    type="text" 
                    value={formData.name} 
                    onChange={handleNameChange} 
                    required 
                    placeholder="e.g. Cinematic SFX"
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Slug (URL Key)</label>
                  <input 
                    type="text" 
                    value={formData.slug} 
                    onChange={(e) => setFormData(p => ({ ...p, slug: e.target.value }))} 
                    required 
                    placeholder="e.g. cinematic-sfx"
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Layout Type</label>
                  <select 
                    value={formData.layout || "media"} 
                    onChange={(e) => setFormData(p => ({ ...p, layout: e.target.value }))}
                    className={styles.select}
                  >
                    <option value="video">Video Grid</option>
                    <option value="image">Image Grid</option>
                    <option value="media">General Media (Auto-detect)</option>
                    <option value="audio">Audio List (Sound Player)</option>
                    <option value="font">Font Grid (Type Preview)</option>
                  </select>
                </div>

                <div className={styles.inputGroup}>
                  <label>Primary Color</label>
                  <div className={styles.colorInputWrap}>
                    <input 
                      type="color" 
                      value={formData.color || "#FFFFFF"} 
                      onChange={(e) => setFormData(p => ({ ...p, color: e.target.value }))} 
                      className={styles.colorPicker}
                    />
                    <input 
                      type="text" 
                      value={formData.color || "#FFFFFF"} 
                      onChange={(e) => setFormData(p => ({ ...p, color: e.target.value }))}
                      className={styles.colorText}
                    />
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label>Display Order</label>
                  <input 
                    type="number" 
                    value={formData.order} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(p => ({ ...p, order: val === "" ? "" : parseInt(val) }));
                    }} 
                    required 
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Allowed Formats (Comma separated)</label>
                  <input 
                    type="text" 
                    value={Array.isArray(formData.formats) ? formData.formats.join(", ") : formData.formats || ""} 
                    onChange={(e) => setFormData(p => ({ ...p, formats: e.target.value.split(",").map(s => s.trim().toLowerCase()).filter(s => s !== "") }))} 
                    placeholder="e.g. mp4, mov, webm"
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>Description (Optional)</label>
                <textarea 
                  value={formData.description} 
                  onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} 
                  rows={2}
                  placeholder="Short description for this category..."
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Category Icon</label>
                <div className={styles.iconGrid}>
                  {ICON_LIST.map(({ id, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      className={`${styles.iconItem} ${formData.icon === id ? styles.active : ""}`}
                      onClick={() => setFormData(p => ({ ...p, icon: id }))}
                      title={id}
                    >
                      <Icon size={20} />
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className={styles.errorMsg}>
                  <AlertTriangle size={14} style={{ marginRight: 4 }} />
                  {error}
                </div>
              )}

              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.saveBtn} disabled={saving}>
                  {saving ? "Saving..." : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
