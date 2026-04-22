"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  FileIcon, 
  Upload, 
  X, 
  Trash2,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import styles from "./page.module.css";
import TagInput from "../../../components/ui/TagInput";
import TreeSelect from "../../../components/ui/TreeSelect";
import { getResource, updateResource, getFolders, getCategories } from "../../../lib/api";
import { uploadFile, deleteFile, generateStoragePath } from "../../../lib/storage";
import { revalidateResourceData } from "../../../lib/actions";
import { isAudioFormat, isVideoFormat, isImageFormat } from "../../../lib/mediaUtils";

const CATEGORIES = [
  { slug: "sound-effects", name: "Sound Effects" },
  { slug: "music", name: "Music" },
  { slug: "video-meme", name: "Video Meme" },
  { slug: "green-screen", name: "Green Screen" },
  { slug: "animation", name: "Animation" },
  { slug: "image-overlay", name: "Image & Overlay" },
  { slug: "font", name: "Font" },
  { slug: "preset-lut", name: "Preset & LUT" },
];

export default function EditResource() {
  const { id } = useParams();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resource, setResource] = useState(null);
  const [allFolders, setAllFolders] = useState([]);
  
  // Form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [allCategories, setAllCategories] = useState([]);
  const [folderId, setFolderId] = useState("");
  const [tags, setTags] = useState([]);
  
  // New file upload state
  const [newFile, setNewFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const fileInputRef = useRef(null);
  const thumbnailInputRef = useRef(null);
  const previewInputRef = useRef(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [resData, foldersData, catsData] = await Promise.all([
          getResource(id),
          getFolders(""), // Placeholder or just handle separately
          getCategories()
        ]);
        
        if (!resData) {
          alert("Resource not found");
          router.push("/admin/resources");
          return;
        }

        setAllCategories(catsData || []);
        setResource(resData);
        setName(resData.name || "");
        setCategory(resData.categoryId || "");
        setFolderId(resData.folderId || "");
        setTags(resData.tags || []);
        
        // Load all folders for this category to build hierarchy
        // resData.categoryId contains the slug string in this system
        if (resData.categoryId) {
          const folders = await getFolders(resData.categoryId);
          setAllFolders(folders);
        }
      } catch (e) {
        console.error("Load failed:", e);
      }
      setLoading(false);
    }
    loadData();
  }, [id, router]);

  // Hierarchical folder list for the dropdown
  const hierarchicalFolders = useMemo(() => {
    const buildTree = (parentId = null, depth = 0) => {
      let result = [];
      const children = allFolders.filter(f => f.parentId === parentId);
      children.forEach(folder => {
        result.push({ 
          ...folder, 
          label: `${depth > 0 ? '—'.repeat(depth) + ' ' : ''}${folder.name}` 
        });
        result = [...result, ...buildTree(folder.id, depth + 1)];
      });
      return result;
    };
    
    const tree = buildTree();
    // Add Root option
    return [
      { id: "", label: "Gốc / Không có", name: "Gốc" },
      ...tree
    ];
  }, [allFolders]);

  // Refetch folders when category changes
  useEffect(() => {
    // Only skip if loading is true (initial load is handled by loadData)
    if (loading || !category) {
      if (!category) setAllFolders([]);
      return;
    }
    
    async function updateFolders() {
      try {
        const folders = await getFolders(category);
        setAllFolders(folders);
        // Reset folder selection if current category changed away from original
        if (category !== resource?.categoryId) {
          setFolderId("");
        }
      } catch (e) {
        console.error("Failed to update folders:", e);
      }
    }
    updateFolders();
  }, [category, loading, resource?.categoryId]);

  const handleFileSelect = (e) => {
    if (e.target.files?.[0]) {
      setNewFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setUploadProgress(0);

    try {
      let updateData = {
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        categoryId: category,
        folderId: folderId || null,
        tags: tags || [],
      };

      // 2. Handle Thumbnail upload
      if (thumbnailFile) {
        const thumbPath = generateStoragePath(category, `thumb-${thumbnailFile.name}`);
        const thumbnailUrl = await uploadFile(thumbnailFile, thumbPath);
        updateData.thumbnailUrl = thumbnailUrl;
      }

      // 3. Handle Preview upload
      if (previewFile) {
        const previewPath = generateStoragePath(category, `preview-${previewFile.name}`);
        const previewUrl = await uploadFile(previewFile, previewPath);
        updateData.previewUrl = previewUrl;
      }

      // 4. If a new main file is uploaded
      if (newFile) {
        // ... (existing main file upload logic)
        const path = generateStoragePath(category, newFile.name);
        const downloadUrl = await uploadFile(newFile, path, 'resources', (p) => setUploadProgress(Math.round(p)));
        
        const fileExtension = newFile.name.includes('.') ? newFile.name.split('.').pop() : 'UNKNOWN';
        
        updateData = {
          ...updateData,
          downloadUrl,
          storagePath: path,
          fileName: newFile.name,
          fileSize: newFile.size,
          fileType: newFile.type,
          fileFormat: fileExtension.toUpperCase(),
        };

        // Delete old file if exists
        if (resource.storagePath) {
          try {
            await deleteFile(resource.storagePath);
          } catch (delErr) {
            console.warn("Failed to delete old file:", delErr.message);
          }
        }
      }

      await updateResource(id, updateData);
      
      // Trigger on-demand revalidation
      await revalidateResourceData();
      
      alert("Resource updated successfully!");
      router.refresh();
      router.push("/admin/resources");
    } catch (e) {
      console.error("Update failed:", e);
      alert("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Loader2 size={40} className="animate-spin" />
        <p>Loading resource data...</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/admin/resources" className={styles.backBtn}>
          <ArrowLeft size={18} />
          Back to List
        </Link>
        <h1 className={styles.title}>Edit Resource</h1>
      </header>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.mainGrid}>
          {/* Metadata Section */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>General Information</h2>
            
            <div className={styles.inputGroup}>
              <label>Resource Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
                placeholder="e.g. Cinematic Boom"
              />
            </div>

            <div className={styles.inputRow}>
              <div className={styles.inputGroup}>
                <label>Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} required>
                  <option value="">Select category...</option>
                  {allCategories.map(c => (
                    <option key={c.slug} value={c.slug}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label>Thư mục hiện tại (Tùy chọn)</label>
                <TreeSelect 
                  options={hierarchicalFolders}
                  value={folderId}
                  onChange={(id) => setFolderId(id)}
                  placeholder="Chọn thư mục trung tâm..."
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>Tags (Nhấn Enter để tách thẻ)</label>
              <TagInput 
                tags={tags} 
                onChange={setTags}
                disabled={saving}
              />
            </div>
          </div>

          {/* Media Previews Section */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Visual Previews</h2>
            
            <div className={styles.mediaGrid}>
              {/* Thumbnail */}
              <div className={styles.mediaItem}>
                <label>Thumbnail (Grid View)</label>
                <div className={styles.mediaPreview}>
                  {thumbnailFile ? (
                    <img src={URL.createObjectURL(thumbnailFile)} alt="New Thumb" />
                  ) : resource?.thumbnailUrl ? (
                    <img src={resource.thumbnailUrl} alt="Current Thumb" />
                  ) : (
                    <div className={styles.noMedia}>No Thumbnail</div>
                  )}
                  <button 
                    type="button" 
                    className={styles.mediaActionBtn}
                    onClick={() => thumbnailInputRef.current?.click()}
                  >
                    {resource?.thumbnailUrl || thumbnailFile ? "Change" : "Upload"}
                  </button>
                  {thumbnailFile && (
                    <button 
                      type="button" 
                      className={styles.removeMediaBtn}
                      onClick={() => setThumbnailFile(null)}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={thumbnailInputRef} 
                  onChange={(e) => setThumbnailFile(e.target.files[0])} 
                  accept="image/*" 
                  style={{ display: "none" }} 
                />
              </div>

              {/* Preview Image */}
              <div className={styles.mediaItem}>
                <label>Preview Image (Full View)</label>
                <div className={styles.mediaPreview}>
                  {previewFile ? (
                    <img src={URL.createObjectURL(previewFile)} alt="New Preview" />
                  ) : resource?.previewUrl ? (
                    <img src={resource.previewUrl} alt="Current Preview" />
                  ) : (
                    <div className={styles.noMedia}>No Preview Image</div>
                  )}
                  <button 
                    type="button" 
                    className={styles.mediaActionBtn}
                    onClick={() => previewInputRef.current?.click()}
                  >
                    {resource?.previewUrl || previewFile ? "Change" : "Upload"}
                  </button>
                  {previewFile && (
                    <button 
                      type="button" 
                      className={styles.removeMediaBtn}
                      onClick={() => setPreviewFile(null)}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={previewInputRef} 
                  onChange={(e) => setPreviewFile(e.target.files[0])} 
                  accept="image/*" 
                  style={{ display: "none" }} 
                />
              </div>
            </div>
          </div>

          {/* File Section */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Resource File</h2>
            
            {/* Current File Info */}
            {!newFile && (
              <div className={styles.currentFile}>
                <div className={styles.fileInfo}>
                  <div className={styles.fileIcon}>
                    <FileIcon size={24} />
                  </div>
                  <div className={styles.fileDetails}>
                    <p className={styles.fileName}>{resource.fileName || "Chưa có thông tin tên file"}</p>
                    <p className={styles.fileMeta}>
                      {resource.fileFormat} • {(resource.fileSize / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button 
                  type="button" 
                  className={styles.replaceBtn}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Replace File
                </button>
              </div>
            )}

            {/* New File Staging */}
            {newFile && (
              <div className={styles.newFileStaging}>
                <div className={styles.fileInfo}>
                  <div className={styles.fileIcon}>
                    <Upload size={24} className={styles.uploadIcon} />
                  </div>
                  <div className={styles.fileDetails}>
                    <p className={styles.fileName}>{newFile.name} (New)</p>
                    <p className={styles.fileMeta}>
                      {(newFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button 
                    type="button" 
                    className={styles.cancelFileBtn}
                    onClick={() => setNewFile(null)}
                    style={{ marginLeft: 'auto' }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            <input 
              ref={fileInputRef}
              type="file" 
              onChange={handleFileSelect} 
              style={{ display: 'none' }}
            />

            {saving && newFile && (
              <div className={styles.progressArea}>
                <div className={styles.progressBarWrap}>
                  <div className={styles.progressBar} style={{ width: `${uploadProgress}%` }}></div>
                </div>
                <p className={styles.progressText}>Uploading new file... {uploadProgress}%</p>
              </div>
            )}

            {/* File Preview Section */}
            <div className={styles.filePreviewContainer}>
              {(newFile || resource?.downloadUrl || resource?.fileUrl) && (
                <div className={styles.filePreviewWrapper}>
                  <label className={styles.previewLabel}>
                    {newFile ? "Xem trước file mới" : "Xem trước file hiện tại"}
                  </label>
                  
                  <div className={styles.previewContent}>
                    {/* AUDIO PREVIEW */}
                    {(newFile ? isAudioFormat({ fileName: newFile.name }) : isAudioFormat(resource)) && (
                      <div className={styles.audioPreview}>
                        <audio 
                          controls 
                          src={newFile ? URL.createObjectURL(newFile) : (resource.downloadUrl || resource.fileUrl)} 
                        />
                      </div>
                    )}

                    {/* VIDEO PREVIEW */}
                    {(newFile ? isVideoFormat({ fileName: newFile.name }) : isVideoFormat(resource)) && (
                      <div className={styles.videoPreview}>
                        <video 
                          controls 
                          src={newFile ? URL.createObjectURL(newFile) : (resource.downloadUrl || resource.fileUrl)} 
                        />
                      </div>
                    )}

                    {/* IMAGE PREVIEW */}
                    {(newFile ? isImageFormat({ fileName: newFile.name }) : isImageFormat(resource)) && (
                      <div className={styles.imagePreview}>
                        <img 
                          src={newFile ? URL.createObjectURL(newFile) : (resource.downloadUrl || resource.fileUrl)} 
                          alt="Preview" 
                        />
                      </div>
                    )}

                    {/* FALLBACK ICON */}
                    {!(newFile ? (isAudioFormat({ fileName: newFile.name }) || isVideoFormat({ fileName: newFile.name }) || isImageFormat({ fileName: newFile.name })) : (isAudioFormat(resource) || isVideoFormat(resource) || isImageFormat(resource))) && (
                      <div className={styles.fallbackPreview}>
                        <FileIcon size={48} strokeWidth={1} />
                        <span>Không có bản xem trước cho định dạng này</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.warningBox}>
              <AlertCircle size={16} />
              <p>Thực hiện thay đổi file sẽ vĩnh viễn xóa file cũ trên Storage.</p>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button 
            type="submit" 
            className={styles.saveBtn} 
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Saving Changes...
              </>
            ) : (
              <>
                <Save size={18} />
                Save Resource
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
