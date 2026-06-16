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
  Upload,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import toast from "react-hot-toast";
import styles from "./page.module.css";
import JSZip from "jszip";

const slugify = (text) => {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

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
    free_for_premium: true,
    sort_order: 0,
    cover_image: "",
    zip_storage_path: "",
    mock_average_rating: 0.0,
    mock_review_count: 0,
  });

  // Pack items & categories
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // Library picker states
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState("files"); // "files" | "folders"
  const [searchQuery, setSearchQuery] = useState("");
  const [libraryResources, setLibraryResources] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [libraryFolders, setLibraryFolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState({});

  // File upload states
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingZip, setUploadingZip] = useState(false);

  // ZIP generation states
  const [generatingZip, setGeneratingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState("");

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
              free_for_premium: pack.free_for_premium !== false,
              sort_order: pack.sort_order || 0,
              cover_image: pack.cover_image || "",
              zip_storage_path: pack.zip_storage_path || "",
              mock_average_rating: pack.mock_average_rating || 0.0,
              mock_review_count: pack.mock_review_count || 0,
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

  // Generate ZIP package from pack items on the client-side
  const handleGenerateZip = async () => {
    if (items.length === 0) {
      toast.error("No items in the list to zip. Please add items first.");
      return;
    }

    setGeneratingZip(true);
    setZipProgress("Initializing ZIP generation...");

    try {
      // Use statically imported JSZip
      const zip = new JSZip();

      // 2. Fetch each file from Supabase storage and add to ZIP
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        setZipProgress(`Downloading ${i + 1}/${items.length}: ${item.file_name}...`);

        if (!item.storage_path) {
          throw new Error(`Item ${item.file_name} has no storage path.`);
        }

        // Authenticated download from Supabase storage directly to client memory
        // Library items are in 'resources' bucket, custom pack-uploaded items are in 'site-assets'
        let bucket = item.resource_id ? "resources" : "site-assets";
        let fileData = null;
        let downloadError = null;

        try {
          const { data, error } = await supabase.storage
            .from(bucket)
            .download(item.storage_path);
          
          if (error) {
            downloadError = error;
          } else {
            fileData = data;
          }
        } catch (e) {
          downloadError = e;
        }

        // Fallback: if download failed, try the other bucket
        if (downloadError) {
          const fallbackBucket = bucket === "resources" ? "site-assets" : "resources";
          try {
            const { data, error } = await supabase.storage
              .from(fallbackBucket)
              .download(item.storage_path);
            
            if (!error && data) {
              fileData = data;
              downloadError = null;
            }
          } catch (e) {
            // keep the original error
          }
        }

        if (downloadError) {
          throw new Error(`Failed to download ${item.file_name} from storage: ${downloadError.message || downloadError}`);
        }

        // Determine correct file name inside zip (ensure correct extension if missing)
        let zipFileName = item.file_name;
        const ext = item.file_format ? `.${item.file_format.toLowerCase()}` : "";
        if (ext && !zipFileName.toLowerCase().endsWith(ext)) {
          zipFileName = `${zipFileName}${ext}`;
        }

        zip.file(zipFileName, fileData);
      }

      setZipProgress("Compressing files into ZIP bundle...");
      const zipBlob = await zip.generateAsync({ type: "blob" });

      setZipProgress("Uploading ZIP package to Storage...");
      const slug = formData.slug || `pack-${Date.now()}`;
      const zipFileName = `${slug}-${Date.now()}.zip`;
      const zipFilePath = `pack-zips/${zipFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("site-assets")
        .upload(zipFilePath, zipBlob, {
          contentType: "application/zip",
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      setFormData((prev) => ({ ...prev, zip_storage_path: zipFilePath }));
      toast.success("ZIP bundle generated and linked successfully!");
    } catch (err) {
      console.error("ZIP Generation failed:", err);
      toast.error("ZIP Generation failed: " + err.message);
    } finally {
      setGeneratingZip(false);
      setZipProgress("");
    }
  };

  // Upload item files directly to Supabase Storage site-assets
  const handleItemUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const slug = formData.slug || `pack-${Date.now()}`;
    const toastId = toast.loading(`Uploading ${files.length} file(s)...`);

    try {
      const uploadedItems = [];
      for (const file of files) {
        const fileExt = file.name.split(".").pop();
        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        const fileName = `${slugify(cleanName)}-${Date.now()}.${fileExt}`;
        const filePath = `pack-items/${slug}/${fileName}`;

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

        const newItem = {
          pack_id: id,
          resource_id: null,
          file_name: file.name,
          file_format: fileExt,
          file_size: file.size,
          storage_path: filePath,
          preview_url: cdnUrl,
          is_previewable: true,
          sort_order: items.length + uploadedItems.length,
        };
        uploadedItems.push(newItem);
      }

      setItems((prev) => [...prev, ...uploadedItems]);
      toast.success(`Uploaded ${files.length} file(s) successfully!`, { id: toastId });
    } catch (err) {
      toast.error("Upload failed: " + err.message, { id: toastId });
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

  // Fetch library folders
  const fetchLibraryFolders = async () => {
    setLoadingFolders(true);
    try {
      let query = supabase
        .from("folders")
        .select("id, name, parent_id, category_id")
        .order("name", { ascending: true });

      if (searchQuery.trim()) {
        query = query.ilike("name", `%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLibraryFolders(data || []);
    } catch (err) {
      toast.error("Failed to fetch folders: " + err.message);
    } finally {
      setLoadingFolders(false);
    }
  };

  // Add all resources of a folder (including all subfolders recursively) to the pack
  const addFolderToPack = async (folderId, folderName) => {
    const toastId = toast.loading(`Adding resources from folder "${folderName}"...`);
    try {
      // 1. Find all descendant folder IDs (including self) from in-memory libraryFolders
      const descendantIds = [folderId];
      const findChildren = (parentId) => {
        libraryFolders.forEach((f) => {
          if (f.parent_id === parentId) {
            descendantIds.push(f.id);
            findChildren(f.id);
          }
        });
      };
      findChildren(folderId);

      // 2. Fetch all published resources under these folder IDs
      const { data: resources, error } = await supabase
        .from("resources")
        .select("id, name, folder_id, file_format, file_size, storage_path, preview_url")
        .in("folder_id", descendantIds)
        .is("is_published", true);

      if (error) throw error;

      if (!resources || resources.length === 0) {
        toast.error(`No published resources found in folder "${folderName}" (or its subfolders)`, { id: toastId });
        return;
      }

      // Filter out resources already in items
      const existingResourceIds = new Set(items.map((item) => item.resource_id).filter(Boolean));
      const newResources = resources.filter((res) => !existingResourceIds.has(res.id));

      if (newResources.length === 0) {
        toast.error("All resources from this folder are already added to the pack", { id: toastId });
        return;
      }

      // 3. Build relative path from the selected folder down to the resource folder
      const folderMap = {};
      libraryFolders.forEach((f) => {
        folderMap[f.id] = f;
      });

      const getRelativePath = (resFolderId) => {
        const pathParts = [];
        let currentId = resFolderId;
        
        while (currentId) {
          const folder = folderMap[currentId];
          if (!folder) break;
          pathParts.unshift(folder.name);
          if (currentId === folderId) break;
          currentId = folder.parent_id;
        }
        
        return pathParts.join("/");
      };

      const newItems = newResources.map((res, index) => {
        let cleanName = res.name;
        const ext = res.file_format ? `.${res.file_format.toLowerCase()}` : "";
        if (ext && !cleanName.toLowerCase().endsWith(ext)) {
          cleanName = `${cleanName}${ext}`;
        }
        
        const relativeFolder = getRelativePath(res.folder_id);
        const fileNameWithPath = relativeFolder ? `${relativeFolder}/${cleanName}` : cleanName;

        return {
          pack_id: id,
          resource_id: res.id,
          file_name: fileNameWithPath,
          file_format: res.file_format,
          file_size: res.file_size || 0,
          storage_path: res.storage_path,
          preview_url: res.preview_url,
          is_previewable: !!res.preview_url,
          sort_order: items.length + index,
        };
      });

      setItems((prev) => [...prev, ...newItems]);
      toast.success(`Successfully added ${newItems.length} resources from folder "${folderName}"`, { id: toastId });
    } catch (err) {
      toast.error(`Failed to add folder: ${err.message}`, { id: toastId });
    }
  };

  const getCategoryName = (catSlug) => {
    const cat = categories.find((c) => c.slug === catSlug);
    return cat ? cat.name : catSlug;
  };

  const buildFolderHierarchy = (foldersList) => {
    const tree = [];
    const map = {};

    foldersList.forEach((f) => {
      map[f.id] = { ...f, children: [] };
    });

    foldersList.forEach((f) => {
      if (f.parent_id && map[f.parent_id]) {
        map[f.parent_id].children.push(map[f.id]);
      } else {
        tree.push(map[f.id]);
      }
    });

    const sortTree = (nodes) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      nodes.forEach((n) => {
        if (n.children.length > 0) {
          sortTree(n.children);
        }
      });
    };
    sortTree(tree);

    const flatList = [];
    const flatten = (nodes, level = 0) => {
      nodes.forEach((node) => {
        flatList.push({ ...node, level });
        if (node.children.length > 0) {
          flatten(node.children, level + 1);
        }
      });
    };
    flatten(tree);
    return flatList;
  };

  // Fetch initial picker resources when opened
  useEffect(() => {
    if (pickerOpen) {
      if (pickerTab === "files") {
        searchResources();
      } else {
        fetchLibraryFolders();
      }
    }
  }, [pickerOpen, pickerTab]);

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

  const enableAllPreviewable = () => {
    setItems((prev) => prev.map((item) => ({ ...item, is_previewable: true })));
    toast.success("Enabled preview for all items");
  };

  const disableAllPreviewable = () => {
    setItems((prev) => prev.map((item) => ({ ...item, is_previewable: false })));
    toast.success("Disabled preview for all items");
  };

  const removeAllItems = () => {
    if (window.confirm("Are you sure you want to remove all items from this pack?")) {
      setItems([]);
      toast.success("Removed all items from the list");
    }
  };

  const getGroupedItems = () => {
    const groups = {
      root: []
    };

    items.forEach((item, originalIndex) => {
      const parts = item.file_name.split("/");
      if (parts.length > 1) {
        // Group by the full folder path (excluding the filename part)
        const folderPath = parts.slice(0, -1).join("/");
        const displayFileName = parts[parts.length - 1];
        if (!groups[folderPath]) {
          groups[folderPath] = [];
        }
        groups[folderPath].push({
          ...item,
          originalIndex,
          displayFileName
        });
      } else {
        groups.root.push({
          ...item,
          originalIndex,
          displayFileName: item.file_name
        });
      }
    });

    return groups;
  };

  const toggleFolderCollapse = (folderName) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderName]: !prev[folderName]
    }));
  };

  const removeFolderFromPack = (folderName, folderItems) => {
    if (window.confirm(`Are you sure you want to remove all items in folder "${folderName}"?`)) {
      const indicesToRemove = new Set(folderItems.map((item) => item.originalIndex));
      setItems((prev) => prev.filter((_, idx) => !indicesToRemove.has(idx)));
      toast.success(`Removed folder "${folderName}" from pack`);
    }
  };

  const toggleFolderPreviewable = (folderName, folderItems, value) => {
    const indicesToUpdate = new Set(folderItems.map((item) => item.originalIndex));
    setItems((prev) =>
      prev.map((item, idx) =>
        indicesToUpdate.has(idx) ? { ...item, is_previewable: value } : item
      )
    );
    toast.success(`Updated preview settings for folder "${folderName}" items`);
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
        free_for_premium: formData.free_for_premium,
        sort_order: parseInt(formData.sort_order) || 0,
        cover_image: formData.cover_image,
        zip_storage_path: formData.zip_storage_path,
        mock_average_rating: parseFloat(formData.mock_average_rating) || 0.0,
        mock_review_count: parseInt(formData.mock_review_count) || 0,
      };

      const apiBody = {
        pack: payload,
        items: items
      };

      const url = isNew ? "/api/admin/shop" : `/api/admin/shop/${id}`;
      const method = isNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiBody)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Server returned ${res.status}`);
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
                <label>Mock Rating (Đánh giá ảo, 1-5)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={formData.mock_average_rating}
                  placeholder="e.g. 4.8"
                  onChange={(e) => setFormData({ ...formData, mock_average_rating: e.target.value })}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Mock Review Count (Lượt đánh giá ảo)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.mock_review_count}
                  placeholder="e.g. 50"
                  onChange={(e) => setFormData({ ...formData, mock_review_count: e.target.value })}
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

              <div className={styles.inputGroup}>
                <div className={styles.toggleRow}>
                  <input
                    type="checkbox"
                    id="free_for_premium"
                    checked={formData.free_for_premium}
                    className={styles.toggle}
                    onChange={(e) => setFormData({ ...formData, free_for_premium: e.target.checked })}
                  />
                  <label htmlFor="free_for_premium" className={styles.toggleLabel}>
                    Free for Premium Members
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
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  type="button"
                  className={styles.addItemBtn}
                  onClick={() => document.getElementById("itemFileInput").click()}
                >
                  <Upload size={14} />
                  <span>Upload File Directly</span>
                </button>
                <button
                  type="button"
                  className={styles.addItemBtn}
                  onClick={() => setPickerOpen(true)}
                >
                  <Plus size={14} />
                  <span>Add from Library</span>
                </button>
              </div>
              <input
                type="file"
                id="itemFileInput"
                multiple
                accept="audio/*"
                style={{ display: "none" }}
                onChange={handleItemUpload}
              />
            </div>

            {items.length > 0 && (
              <div className={styles.bulkActionsBar}>
                <span className={styles.bulkActionsLabel}>Bulk Actions ({items.length} items):</span>
                <div className={styles.bulkActionsButtons}>
                  <button
                    type="button"
                    className={styles.bulkBtn}
                    onClick={enableAllPreviewable}
                  >
                    Enable Preview for All
                  </button>
                  <button
                    type="button"
                    className={styles.bulkBtn}
                    onClick={disableAllPreviewable}
                  >
                    Disable Preview for All
                  </button>
                  <button
                    type="button"
                    className={`${styles.bulkBtn} ${styles.bulkBtnDanger}`}
                    onClick={removeAllItems}
                  >
                    Remove All Items
                  </button>
                </div>
              </div>
            )}

            <div className={styles.itemsList}>
              {items.length === 0 ? (
                <div className={styles.emptyItems}>
                  This pack contains no items. Click &ldquo;Add from Library&rdquo; to add items.
                </div>
              ) : (
                (() => {
                  const grouped = getGroupedItems();
                  const folderNames = Object.keys(grouped).filter((k) => k !== "root");
                  
                  return (
                    <>
                      {/* Render Folders */}
                      {folderNames.map((folderName) => {
                        const folderItems = grouped[folderName];
                        const isCollapsed = !!collapsedFolders[folderName];
                        const allPreviewable = folderItems.every((item) => item.is_previewable);
                        
                        return (
                          <div key={folderName} className={styles.folderGroup}>
                            {/* Folder Header */}
                            <div className={styles.folderGroupHeader}>
                              <button
                                type="button"
                                className={styles.collapseToggleBtn}
                                onClick={() => toggleFolderCollapse(folderName)}
                              >
                                {isCollapsed ? (
                                  <ChevronRight size={16} />
                                ) : (
                                  <ChevronDown size={16} />
                                )}
                              </button>
                              
                              <div className={styles.folderHeaderInfo} onClick={() => toggleFolderCollapse(folderName)}>
                                <Folder size={16} className={styles.folderIcon} style={{ color: "var(--premium-gold)" }} />
                                <span className={styles.folderHeaderName}>{folderName}</span>
                                <span className={styles.folderItemCount}>({folderItems.length} items)</span>
                              </div>

                              <div className={styles.folderHeaderMeta}>
                                <label className={styles.previewToggle}>
                                  <input
                                    type="checkbox"
                                    checked={allPreviewable}
                                    onChange={(e) => toggleFolderPreviewable(folderName, folderItems, e.target.checked)}
                                  />
                                  <span>All Previewable</span>
                                </label>
                                <button
                                  type="button"
                                  onClick={() => removeFolderFromPack(folderName, folderItems)}
                                  className={styles.removeItemBtn}
                                  title="Remove entire folder"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            {/* Folder Items */}
                            {!isCollapsed && (
                              <div className={styles.folderGroupContent}>
                                {folderItems.map((item) => (
                                  <div key={item.originalIndex} className={`${styles.itemRow} ${styles.itemRowNested}`}>
                                    <span className={styles.itemFileName}>{item.displayFileName}</span>
                                    <div className={styles.itemMeta}>
                                      <span>{item.file_format?.toUpperCase()}</span>
                                      <span>
                                        {item.file_size ? `${(item.file_size / 1024 / 1024).toFixed(2)} MB` : "0 MB"}
                                      </span>
                                      <label className={styles.previewToggle}>
                                        <input
                                          type="checkbox"
                                          checked={item.is_previewable}
                                          onChange={(e) => togglePreviewable(item.originalIndex, e.target.checked)}
                                        />
                                        <span>Previewable</span>
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => removePackItem(item.originalIndex)}
                                        className={styles.removeItemBtn}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Render Root (Uncategorized) Items */}
                      {grouped.root.length > 0 && (
                        <div className={styles.rootItemsGroup}>
                          {folderNames.length > 0 && (
                            <div className={styles.rootItemsTitle}>
                              Uncategorized / Direct Uploads
                            </div>
                          )}
                          {grouped.root.map((item) => (
                            <div key={item.originalIndex} className={styles.itemRow}>
                              <span className={styles.itemFileName}>{item.displayFileName}</span>
                              <div className={styles.itemMeta}>
                                <span>{item.file_format?.toUpperCase()}</span>
                                <span>
                                  {item.file_size ? `${(item.file_size / 1024 / 1024).toFixed(2)} MB` : "0 MB"}
                                </span>
                                <label className={styles.previewToggle}>
                                  <input
                                    type="checkbox"
                                    checked={item.is_previewable}
                                    onChange={(e) => togglePreviewable(item.originalIndex, e.target.checked)}
                                  />
                                  <span>Previewable</span>
                                </label>
                                <button
                                  type="button"
                                  onClick={() => removePackItem(item.originalIndex)}
                                  className={styles.removeItemBtn}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()
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
                disabled={uploadingZip || generatingZip}
              >
                {uploadingZip ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <FileArchive size={14} />
                )}
                <span>{uploadingZip ? "Uploading ZIP..." : "Upload ZIP Archive"}</span>
              </button>

              <button
                type="button"
                className={styles.generateZipBtn}
                onClick={handleGenerateZip}
                disabled={generatingZip || uploadingZip || items.length === 0}
              >
                {generatingZip ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <FileArchive size={14} />
                )}
                <span>{generatingZip ? "Generating..." : "Generate ZIP from Pack Items"}</span>
              </button>

              <input
                type="file"
                id="zipInput"
                accept=".zip"
                className={styles.hiddenInput}
                onChange={handleZipUpload}
              />
            </div>

            {generatingZip && zipProgress && (
              <div className={styles.zipProgressContainer}>
                Status: <span className={styles.zipProgressText}>{zipProgress}</span>
              </div>
            )}
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

            <div className={styles.pickerTabs}>
              <button
                type="button"
                className={`${styles.pickerTab} ${pickerTab === "files" ? styles.pickerTabActive : ""}`}
                onClick={() => {
                  setPickerTab("files");
                  setSearchQuery("");
                }}
              >
                Single Files
              </button>
              <button
                type="button"
                className={`${styles.pickerTab} ${pickerTab === "folders" ? styles.pickerTabActive : ""}`}
                onClick={() => {
                  setPickerTab("folders");
                  setSearchQuery("");
                }}
              >
                Entire Folders
              </button>
            </div>

            <div className={styles.pickerSearch}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder={pickerTab === "files" ? "Search resources by name..." : "Search folders by name..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (pickerTab === "files") {
                      searchResources();
                    } else {
                      fetchLibraryFolders();
                    }
                  }
                }}
              />
            </div>

            <div className={styles.pickerList}>
              {pickerTab === "files" ? (
                loadingResources ? (
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
                )
              ) : (
                loadingFolders ? (
                  <div className={styles.pickerLoading}>
                    <Loader2 className="animate-spin" size={24} />
                  </div>
                ) : libraryFolders.length === 0 ? (
                  <div className={styles.pickerEmpty}>No folders found.</div>
                ) : (
                  buildFolderHierarchy(libraryFolders).map((folder) => {
                    return (
                      <div
                        key={folder.id}
                        className={styles.pickerFolderItem}
                        style={{ paddingLeft: `${16 + folder.level * 20}px` }}
                      >
                        <div className={styles.folderInfo}>
                          <Folder size={16} className={styles.folderIcon} style={{ color: "var(--premium-gold)", flexShrink: 0 }} />
                          <span className={styles.folderName}>{folder.name}</span>
                          {!folder.parent_id && folder.category_id && (
                            <span className={styles.folderCategory}>
                              {getCategoryName(folder.category_id)}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className={styles.addFolderBtn}
                          onClick={() => addFolderToPack(folder.id, folder.name)}
                        >
                          Add Folder
                        </button>
                      </div>
                    );
                  })
                )
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
