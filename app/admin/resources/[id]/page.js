"use client";

import { useState, useEffect, useRef } from "react";
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
import { getResource, updateResource, getFolders } from "../../../lib/firestore";
import { uploadFile, deleteFile, generateStoragePath } from "../../../lib/storage";
import { revalidateResourceData } from "../../../lib/actions";

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
  const [folderId, setFolderId] = useState("");
  const [tags, setTags] = useState("");
  
  // New file upload state
  const [newFile, setNewFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [resData, foldersData] = await Promise.all([
          getResource(id),
          // We can't easily get folders for all categories without a dedicated function, 
          // so let's fetch for the current category once it's known
        ]);
        
        if (!resData) {
          alert("Resource not found");
          router.push("/admin/resources");
          return;
        }
        
        setResource(resData);
        setName(resData.name || "");
        setCategory(resData.category || "");
        setFolderId(resData.folderId || "");
        setTags(resData.tags ? resData.tags.join(", ") : "");
        
        // Load folders for this category
        if (resData.category) {
          const folders = await getFolders(resData.category, null);
          setAllFolders(folders);
        }
      } catch (e) {
        console.error("Load failed:", e);
      }
      setLoading(false);
    }
    loadData();
  }, [id, router]);

  // Refetch folders when category changes
  useEffect(() => {
    if (!category) {
      setAllFolders([]);
      return;
    }
    async function loadFolders() {
      try {
        const folders = await getFolders(category, null);
        setAllFolders(folders);
      } catch (e) {
        console.error("Failed to load folders:", e);
      }
    }
    loadFolders();
  }, [category]);

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
        category,
        folderId: folderId || null,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      };

      // If a new file is uploaded
      if (newFile) {
        // 1. Upload new file
        const path = generateStoragePath(category, newFile.name);
        const downloadUrl = await uploadFile(newFile, path, (p) => setUploadProgress(Math.round(p)));
        
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

        // 2. Delete old file if exists
        if (resource.storagePath) {
          try {
            await deleteFile(resource.storagePath);
          } catch (delErr) {
            console.warn("Failed to delete old file:", delErr.message);
            // Don't block the update if deletion fails (e.g. file already gone)
          }
        }
      }

      await updateResource(id, updateData);
      
      // Trigger on-demand revalidation
      await revalidateResourceData();
      
      alert("Resource updated successfully!");
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
                  {CATEGORIES.map(c => (
                    <option key={c.slug} value={c.slug}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label>Folder (Optional)</label>
                <select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
                  <option value="">Root / None</option>
                  {allFolders.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>Tags (comma separated)</label>
              <input 
                type="text" 
                value={tags} 
                onChange={(e) => setTags(e.target.value)} 
                placeholder="impact, cinematic, cinematic dark..."
              />
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
                    <p className={styles.fileName}>{resource.fileName}</p>
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
