"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Loader2,
  Search,
  Image as ImageIcon,
  FileArchive,
  X,
  Check,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import toast from "react-hot-toast";
import styles from "./page.module.css";

export default function EditPackPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const id = params.id;
  const isNew = id === "new";

  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    short_description: "",
    description: "",
    price: 0,
    original_price: "",
    category_id: "",
    tags: "",
    status: "draft",
    is_featured: false,
    sort_order: 0,
    cover_image: "",
    zip_storage_path: "",
  });

  // Pack items & categories
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // Library picker states
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [libraryResources, setLibraryResources] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);

  // File upload states
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingZip, setUploadingZip] = useState(false);

  // Load categories & pack data
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);

        // Fetch categories
        const { data: cats, error: catsErr } = await supabase
          .from("categories")
          .select("slug, name")
          .order("name");

        if (catsErr) throw catsErr;
        setCategories(cats || []);

        if (!isNew) {
          // Fetch pack
          const { data: pack, error: packErr } = await supabase
            .from("sound_packs")
            .select("*")
            .eq("id", id)
            .single();

          if (packErr) throw packErr;

          if (pack) {
            setFormData({
              name: pack.name || "",
              slug: pack.slug || "",
              short_description: pack.short_description || "",
              description: pack.description || "",
              price: pack.price || 0,
              original_price: pack.original_price || "",
              category_id: pack.category_id || "",
              tags: pack.tags ? pack.tags.join(", ") : "",
              status: pack.status || "draft",
              is_featured: pack.is_featured || false,
              sort_order: pack.sort_order || 0,
              cover_image: pack.cover_image || "",
              zip_storage_path: pack.zip_storage_path || "",
            });

            // Fetch pack items
            const { data: packItems, error: itemsErr } = await supabase
              .from("sound_pack_items")
              .select("*")
              .eq("pack_id", id)
              .order("sort_order", { ascending: true });

            if (itemsErr) throw itemsErr;
            setItems(packItems || []);
          }
        }
      } catch (err) {
        toast.error("Failed to load data: " + err.message);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [id, isNew]);

  // Handle title changes to auto-slugify
  const handleNameChange = (e) => {
    const val = e.target.value;
    setFormData((prev) => {
      const newSlug = isNew
        ? val
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "")
        : prev.slug;
      return { ...prev, name: val, slug: newSlug };
    });
  };

  // Upload Cover Image directly to Supabase Storage site-assets
  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    try {
      const fileExt = file.name.split(".").pop();
      const slug = formData.slug || `pack-${Date.now()}`;
      const fileName = `${slug}-${Date.now()}.${fileExt}`;
      const filePath = `pack-covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("site-assets")
        .upload(filePath, file, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage.from("site-assets").getPublicUrl(filePath);
      
      // Rewrite to CDN hostname
      const cdnUrl = data.publicUrl.replace(
        "riorhpppwzbnjaucatjc.supabase.co",
        "cdn.sfxfolder.com"
      );

      setFormData((prev) => ({ ...prev, cover_image: cdnUrl }));
      toast.success("Cover image uploaded!");
    } catch (err) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploadingCover(false);
    }
  };

  // Upload ZIP directly to Supabase Storage site-assets
  const handleZipUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingZip(true);
    try {
      const fileExt = file.name.split(".").pop();
      const slug = formData.slug || `pack-${Date.now()}`;
      const fileName = `${slug}-${Date.now()}.${fileExt}`;
      const filePath = `pack-zips/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("site-assets")
        .upload(filePath, file, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      setFormData((prev) => ({ ...prev, zip_storage_path: filePath }));
      toast.success("ZIP package uploaded!");
    } catch (err) {
      toast.error("ZIP upload failed: " + err.message);
    } finally {
      setUploadingZip(false);
    }
  };

  // Search resources in library
  const searchResources = async () => {
    setLoadingResources(true);
    try {
      let query = supabase
        .from("resources")
        .select("id, name, file_format, file_size, storage_path, preview_url")
        .is("is_published", true);

      if (searchQuery.trim()) {
        query = query.ilike("name", `%${searchQuery}%`);
      }

      const { data, error } = await query.limit(20);
      if (error) throw error;
      setLibraryResources(data || []);
    } catch (err) {
      toast.error("Failed to fetch resources: " + err.message);
    } finally {
      setLoadingResources(false);
    }
  };

  // Fetch initial picker resources when opened
  useEffect(() => {
    if (pickerOpen) {
      searchResources();
    }
  }, [pickerOpen]);

  // Add resource from library picker to pack items
  const addResourceToPack = (resource) => {
    // Check if already in pack
    if (items.some((item) => item.resource_id === resource.id)) {
      toast.error("This resource is already added to the pack");
      return;
    }

    const newItem = {
      pack_id: id,
      resource_id: resource.id,
      file_name: resource.name,
      file_format: resource.file_format,
      file_size: resource.file_size || 0,
      storage_path: resource.storage_path,
      preview_url: resource.preview_url,
      is_previewable: !!resource.preview_url,
      sort_order: items.length,
    };

    setItems((prev) => [...prev, newItem]);
    toast.success("Added resource to pack items list");
  };

  const removePackItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const togglePreviewable = (index, value) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], is_previewable: value };
      return updated;
    });
  };

  // Save changes
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.slug.trim()) {
      toast.error("Name and Slug are required");
      return;
    }

    setSaving(true);
    try {
      const parsedTags = formData.tags
        ? formData.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [];

      const payload = {
        name: formData.name,
        slug: formData.slug,
        short_description: formData.short_description,
        description: formData.description,
        price: parseFloat(formData.price) || 0,
        original_price: formData.original_price ? parseFloat(formData.original_price) : null,
        category_id: formData.category_id || null,
        tags: parsedTags,
        status: formData.status,
        is_featured: formData.is_featured,
        sort_order: parseInt(formData.sort_order) || 0,
        cover_image: formData.cover_image,
        zip_storage_path: formData.zip_storage_path,
      };

      let packId = id;

      if (isNew) {
        // Create new pack
        const { data, error } = await supabase
          .from("sound_packs")
          .insert(payload)
          .select("id")
          .single();

        if (error) throw error;
        packId = data.id;
      } else {
        // Update existing pack
        const { error } = await supabase
          .from("sound_packs")
          .update(payload)
          .eq("id", id);

        if (error) throw error;
      }

      // Sync items: Delete removed items & Upsert current items
      // For simplicity, we get current items in DB, delete items not in local list, and insert/update current items
      const { data: dbItems } = await supabase
        .from("sound_pack_items")
        .select("id, resource_id")
        .eq("pack_id", packId);

      const dbResourceIds = dbItems ? dbItems.map((di) => di.resource_id).filter(Boolean) : [];
      const localResourceIds = items.map((li) => li.resource_id).filter(Boolean);

      // 1. Delete items that were removed
      const toDelete = dbItems?.filter((di) => di.resource_id && !localResourceIds.includes(di.resource_id)) || [];
      if (toDelete.length > 0) {
        await supabase
          .from("sound_pack_items")
          .delete()
          .in("id", toDelete.map((td) => td.id));
      }

      // 2. Upsert items
      const itemsToUpsert = items.map((item, idx) => ({
        id: item.id || undefined, // undefined will auto-generate id on insert
        pack_id: packId,
        resource_id: item.resource_id,
        file_name: item.file_name,
        file_format: item.file_format,
        file_size: item.file_size,
        storage_path: item.storage_path,
        preview_url: item.preview_url,
        is_previewable: item.is_previewable,
        sort_order: idx,
      }));

      if (itemsToUpsert.length > 0) {
        const { error: itemsError } = await supabase
          .from("sound_pack_items")
          .upsert(itemsToUpsert);
        
        if (itemsError) throw itemsError;
      }

      toast.success("Sound pack saved successfully!");
      router.push("/admin/shop");
    } catch (err) {
      toast.error("Failed to save pack: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const getZipSize = () => {
    // If we want to sum items size
    const totalBytes = items.reduce((sum, item) => sum + (item.file_size || 0), 0);
    if (totalBytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(totalBytes) / Math.log(k));
    return parseFloat((totalBytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingArea}>
          <Loader2 className={`${styles.spinner} animate-spin`} size={32} />
          <p>Loading editor data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button onClick={() => router.push("/admin/shop")} className={styles.backBtn}>
            <ArrowLeft size={16} />
          </button>
          <h1 className={styles.title}>
            {isNew ? "Create Sound Pack" : "Edit Sound Pack"}
          </h1>
        </div>
        <div className={styles.headerActions}>
          <button
            onClick={handleSave}
            disabled={saving}
            className={styles.saveBtn}
          >
            {saving ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Save size={14} />
            )}
            <span>Save Pack</span>
          </button>
        </div>
      </header>

      {/* TABS */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "general" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("general")}
        >
          General
        </button>
        <button
          className={`${styles.tab} ${activeTab === "items" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("items")}
        >
          Items ({items.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === "zip" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("zip")}
        >
          ZIP Bundle
        </button>
      </div>

      {/* TAB CONTENT */}
      <div className={styles.tabContent}>
        {activeTab === "general" && (
          <form onSubmit={handleSave} className={styles.form}>
            <div className={styles.formGrid}>
              <div className={styles.inputGroup}>
                <label>Pack Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={handleNameChange}
                  required
                  placeholder="e.g. Cinematic Transitions Pack"
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Slug URL (auto-generated)</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  required
                  placeholder="cinematic-transitions-pack"
                />
                <span className={styles.slugPreview}>
                  Path: /shop/{formData.slug || "..."}
                </span>
              </div>

              <div className={styles.inputGroup}>
                <label>Price (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Original Price (USD, Optional for Discount)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.original_price}
                  placeholder="e.g. 19.99"
                  onChange={(e) => setFormData({ ...formData, original_price: e.target.value })}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Category</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat.slug} value={cat.slug}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label>Tags (comma separated)</label>
                <input
                  type="text"
                  value={formData.tags}
                  placeholder="cinematic, transition, whoosh"
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Sort Order</label>
                <input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                />
              </div>

              <div className={styles.inputGroup}>
                <div className={styles.toggleRow}>
                  <input
                    type="checkbox"
                    id="is_featured"
                    checked={formData.is_featured}
                    className={styles.toggle}
                    onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                  />
                  <label htmlFor="is_featured" className={styles.toggleLabel}>
                    Featured Pack (shows on top)
                  </label>
                </div>
              </div>

              <div className={styles.inputGroupFull}>
                <label>Short Description (card summary)</label>
                <input
                  type="text"
                  maxLength={150}
                  value={formData.short_description}
                  placeholder="Cinematic sound effects, transition hits, ambient whooshes for video editing."
                  onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                />
              </div>

              <div className={styles.inputGroupFull}>
                <label>Description (Markdown supported)</label>
                <textarea
                  value={formData.description}
                  rows={8}
                  placeholder="Enter deep description, bundle details, compatibility..."
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className={styles.inputGroupFull}>
                <label>Cover Image</label>
                <div className={styles.coverSection}>
                  {formData.cover_image ? (
                    <img
                      src={formData.cover_image}
                      alt="Cover image"
                      className={styles.coverPreview}
                    />
                  ) : (
                    <div className={styles.coverPlaceholder}>
                      <ImageIcon size={48} />
                    </div>
                  )}
                  <button
                    type="button"
                    className={styles.uploadBtn}
                    onClick={() => document.getElementById("coverInput").click()}
                    disabled={uploadingCover}
                  >
                    {uploadingCover ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <ImageIcon size={14} />
                    )}
                    <span>{uploadingCover ? "Uploading..." : "Upload Image"}</span>
                  </button>
                  <input
                    type="file"
                    id="coverInput"
                    accept="image/*"
                    className={styles.hiddenInput}
                    onChange={handleCoverUpload}
                  />
                </div>
              </div>
            </div>
          </form>
        )}

        {activeTab === "items" && (
          <div className={styles.form}>
            <div className={styles.itemsHeader}>
              <span className={styles.itemsTitle}>Pack Contents</span>
              <button
                type="button"
                className={styles.addItemBtn}
                onClick={() => setPickerOpen(true)}
              >
                <Plus size={14} />
                <span>Add from Library</span>
              </button>
            </div>

            <div className={styles.itemsList}>
              {items.length === 0 ? (
                <div className={styles.emptyItems}>
                  This pack contains no items. Click &ldquo;Add from Library&rdquo; to add items.
                </div>
              ) : (
                items.map((item, idx) => (
                  <div key={idx} className={styles.itemRow}>
                    <span className={styles.itemFileName}>{item.file_name}</span>
                    <div className={styles.itemMeta}>
                      <span>{item.file_format?.toUpperCase()}</span>
                      <span>
                        {item.file_size ? `${(item.file_size / 1024 / 1024).toFixed(2)} MB` : "0 MB"}
                      </span>
                      <label className={styles.previewToggle}>
                        <input
                          type="checkbox"
                          checked={item.is_previewable}
                          onChange={(e) => togglePreviewable(idx, e.target.checked)}
                        />
                        <span>Previewable</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => removePackItem(idx)}
                        className={styles.removeItemBtn}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "zip" && (
          <div className={styles.zipInfo}>
            {formData.zip_storage_path ? (
              <div className={styles.zipCard}>
                <FileArchive size={32} className={styles.zipIcon} />
                <div className={styles.zipDetails}>
                  <span className={styles.zipPath}>{formData.zip_storage_path}</span>
                  <span className={styles.zipSize}>
                    Total pack items size: {getZipSize()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, zip_storage_path: "" })}
                  className={styles.removeZipBtn}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className={styles.noZip}>
                No ZIP package linked to this pack. Please upload a ZIP archive for user downloads.
              </div>
            )}

            <div className={styles.zipActions}>
              <button
                type="button"
                className={styles.uploadBtn}
                onClick={() => document.getElementById("zipInput").click()}
                disabled={uploadingZip}
              >
                {uploadingZip ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <FileArchive size={14} />
                )}
                <span>{uploadingZip ? "Uploading ZIP..." : "Upload ZIP Archive"}</span>
              </button>
              <input
                type="file"
                id="zipInput"
                accept=".zip"
                className={styles.hiddenInput}
                onChange={handleZipUpload}
              />
            </div>
          </div>
        )}
      </div>

      {/* RESOURCE PICKER MODAL */}
      {pickerOpen && (
        <div className={styles.pickerOverlay}>
          <div className={styles.pickerModal}>
            <div className={styles.pickerHeader}>
              <h3 className={styles.pickerTitle}>Select Resource from Library</h3>
              <button className={styles.closeBtn} onClick={() => setPickerOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.pickerSearch}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search resources by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchResources()}
              />
            </div>

            <div className={styles.pickerList}>
              {loadingResources ? (
                <div className={styles.pickerLoading}>
                  <Loader2 className="animate-spin" size={24} />
                </div>
              ) : libraryResources.length === 0 ? (
                <div className={styles.pickerEmpty}>No resources found.</div>
              ) : (
                libraryResources.map((res) => {
                  const isAdded = items.some((item) => item.resource_id === res.id);
                  return (
                    <div
                      key={res.id}
                      className={`${styles.pickerItem} ${isAdded ? styles.pickerItemAdded : ""}`}
                      onClick={() => !isAdded && addResourceToPack(res)}
                    >
                      <span className={styles.pickerItemName}>{res.name}</span>
                      <div className={styles.pickerItemMeta}>
                        <span>{res.file_format?.toUpperCase()}</span>
                        {isAdded && (
                          <span style={{ marginLeft: "10px", color: "var(--premium-gold)", fontWeight: 700 }}>
                            <Check size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Added
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className={styles.modalActions} style={{ marginTop: "1rem" }}>
              <button
                className={styles.cancelBtn}
                onClick={() => setPickerOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
