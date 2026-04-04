"use client";

import { useState, useRef } from "react";
import { Upload, X, FileIcon, Loader2, StopCircle, FolderOpen } from "lucide-react";
import styles from "./page.module.css";
import { uploadFile, generateStoragePath } from "../../../lib/storage";
import { addResource } from "../../../lib/firestore";

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

const getFilesFromDataTransferItems = async (items) => {
  const files = [];
  const queue = [];
  for (const item of items) {
    if (item.kind === 'file') {
      queue.push(item.webkitGetAsEntry());
    }
  }

  const readEntriesPromise = async (directoryReader) => {
    return new Promise((resolve, reject) => {
      directoryReader.readEntries(resolve, reject);
    });
  };

  const getFilePromise = async (fileEntry) => {
    return new Promise((resolve, reject) => {
      fileEntry.file(resolve, reject);
    });
  };

  while (queue.length > 0) {
    const entry = queue.shift();
    if (!entry) continue;
    if (entry.isFile) {
      const file = await getFilePromise(entry);
      Object.defineProperty(file, 'customPath', {
        value: entry.fullPath.substring(1), // remove leading slash
        writable: false,
      });
      files.push(file);
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      let entries = [];
      let readResult;
      do {
        readResult = await readEntriesPromise(dirReader);
        entries.push(...readResult);
      } while (readResult.length > 0);
      for (const child of entries) {
        queue.push(child);
      }
    }
  }
  return files;
};

export default function NewResource() {
  const [files, setFiles] = useState([]);
  const [bulkCategory, setBulkCategory] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const cancelRef = useRef(false);

  const createStagingItem = (file) => {
    let path = file.customPath || file.webkitRelativePath || file.name;
    let folderName = "";
    const parts = path.split('/');
    if (parts.length > 1) {
      parts.pop(); // remove filename
      folderName = parts.join('/');
    }

    // Try to auto-guess category from top level folder
    let guessedCategory = "";
    if (folderName) {
      const topLevel = folderName.split('/')[0].toLowerCase();
      const match = CATEGORIES.find(c => 
        topLevel.includes(c.slug.replace('-', ' ')) || 
        c.slug.includes(topLevel.replace(' ', '-'))
      );
      if (match) guessedCategory = match.slug;
    }

    return {
      rawFile: file,
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
      name: file.name,
      size: file.size,
      folder: folderName,
      category: guessedCategory,
      tags: "",
      status: "pending" // pending, uploading, success, error
    };
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    if (e.dataTransfer.items) {
      const extractedFiles = await getFilesFromDataTransferItems(e.dataTransfer.items);
      const newItems = extractedFiles.map(f => createStagingItem(f));
      setFiles((prev) => [...prev, ...newItems]);
    } else {
      const droppedFiles = Array.from(e.dataTransfer.files);
      const newItems = droppedFiles.map(f => createStagingItem(f));
      setFiles((prev) => [...prev, ...newItems]);
    }
  };

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files);
    const newItems = selected.map(f => createStagingItem(f));
    setFiles((prev) => [...prev, ...newItems]);
    // reset input
    if (e.target) e.target.value = null;
  };

  const removeFile = (id) => {
    setFiles((prev) => prev.filter(f => f.id !== id));
  };

  const updateFileObj = (id, field, value) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const applyBulkCategory = () => {
    if (!bulkCategory) return;
    setFiles(prev => prev.map(f => ({ ...f, category: bulkCategory })));
  };

  const handleCancel = () => {
    cancelRef.current = true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'error');
    if (pendingFiles.length === 0) return;

    // Validation
    const missingCategory = pendingFiles.find(f => !f.category);
    if (missingCategory) {
      alert(`File "${missingCategory.name}" is missing a category!`);
      return;
    }

    cancelRef.current = false;
    setIsUploading(true);
    setProgress(0);
    let completedCount = 0;

    try {
      for (const item of pendingFiles) {
        if (cancelRef.current) {
          alert('Upload cancelled by user.');
          break;
        }

        updateFileObj(item.id, 'status', 'uploading');
        
        try {
          const path = generateStoragePath(item.category, item.name);
          const downloadUrl = await uploadFile(item.rawFile, path);
  
          const resourceData = {
            name: item.name,
            slug: item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            category: item.category,
            folder: item.folder,
            tags: item.tags ? item.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
            fileName: item.name,
            fileSize: item.size,
            fileType: item.rawFile.type,
            downloadUrl: downloadUrl,
            storagePath: path,
          };
  
          await addResource(resourceData);
          updateFileObj(item.id, 'status', 'success');
        } catch (fileErr) {
          console.error("Error uploading file", item.name, fileErr);
          updateFileObj(item.id, 'status', 'error');
        }

        completedCount++;
        setProgress(Math.round((completedCount / pendingFiles.length) * 100));
      }

      if (!cancelRef.current) {
        alert('Batch processing finished!');
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Error: " + error.message);
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Add Resources</h1>

      <div className={styles.form}>
        {/* Drop zone */}
        <div
          className={styles.dropZone}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          style={{ opacity: isUploading ? 0.5 : 1, pointerEvents: isUploading ? 'none' : 'auto' }}
        >
          <Upload size={32} className={styles.dropIcon} />
          <p>Drag & drop files or folders here</p>
          <p className={styles.dropHint}>Or use buttons below to browse</p>
          <div className={styles.browseButtons}>
            <button type="button" onClick={() => fileInputRef.current?.click()} className={styles.browseBtn}>
              <FileIcon size={14} /> Select Files
            </button>
            <button type="button" onClick={() => folderInputRef.current?.click()} className={styles.browseBtn}>
              <FolderOpen size={14} /> Select Folder
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            style={{ display: "none" }}
            disabled={isUploading}
          />
          <input
            ref={folderInputRef}
            type="file"
            webkitdirectory="true"
            directory="true"
            multiple
            onChange={handleFileSelect}
            style={{ display: "none" }}
            disabled={isUploading}
          />
        </div>

        {/* Bulk Actions */}
        {files.length > 0 && (
          <div className={styles.bulkActions}>
            <label className={styles.label}>Bulk Apply Category:</label>
            <div className={styles.bulkRow}>
              <select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} disabled={isUploading}>
                <option value="">Select category...</option>
                {CATEGORIES.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
              <button type="button" onClick={applyBulkCategory} disabled={!bulkCategory || isUploading} className={styles.secondaryBtn}>
                Apply to All
              </button>
            </div>
          </div>
        )}

        {/* Staging Table */}
        {files.length > 0 && (
          <div className={styles.tableContainer}>
            <table className={styles.stagingTable}>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Folder Path</th>
                  <th>Category</th>
                  <th>Tags (comma)</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id} className={file.status === 'success' ? styles.rowSuccess : ''}>
                    <td className={styles.tdFile}>
                      <div className={styles.fileInfo}>
                        <FileIcon size={14} className={styles.tableIcon} />
                        <span title={file.name}>{file.name}</span>
                      </div>
                    </td>
                    <td>
                      <input 
                        type="text" 
                        value={file.folder} 
                        onChange={(e) => updateFileObj(file.id, 'folder', e.target.value)}
                        placeholder="Root"
                        disabled={isUploading || file.status === 'success'}
                      />
                    </td>
                    <td>
                      <select 
                        value={file.category} 
                        onChange={(e) => updateFileObj(file.id, 'category', e.target.value)}
                        disabled={isUploading || file.status === 'success'}
                      >
                        <option value="">-- Choose --</option>
                        {CATEGORIES.map((c) => (
                          <option key={c.slug} value={c.slug}>{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input 
                        type="text" 
                        value={file.tags} 
                        onChange={(e) => updateFileObj(file.id, 'tags', e.target.value)}
                        placeholder="tags..."
                        disabled={isUploading || file.status === 'success'}
                      />
                    </td>
                    <td className={styles.tdStatus}>
                      {file.status === 'pending' && <span className={styles.badgePending}>Pending</span>}
                      {file.status === 'uploading' && <span className={styles.badgeUploading}><Loader2 size={12} className="animate-spin" /> Uploading</span>}
                      {file.status === 'success' && <span className={styles.badgeSuccess}>Done</span>}
                      {file.status === 'error' && <span className={styles.badgeError}>Error</span>}
                    </td>
                    <td>
                      <button 
                        type="button" 
                        className={styles.removeBtn} 
                        onClick={() => removeFile(file.id)} 
                        disabled={isUploading || file.status === 'success'}
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.actionsRow}>
          <button type="submit" onClick={handleSubmit} className={styles.submitBtn} disabled={files.length === 0 || isUploading}>
            {isUploading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Uploading... {progress}%
              </>
            ) : (
              <>
                <Upload size={18} />
                Upload Pending
              </>
            )}
          </button>
          
          {isUploading && (
            <button type="button" onClick={handleCancel} className={styles.cancelBtn}>
              <StopCircle size={18} />
              Cancel Remaining
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
