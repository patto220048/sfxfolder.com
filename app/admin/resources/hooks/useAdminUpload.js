"use client";

import { useState, useCallback } from "react";
import { uploadFile, generateStoragePath } from "../../../lib/storage";
import { addResource } from "../../../lib/firestore";
import { revalidateResourceData } from "../../../lib/actions";
import { cleanFileName, convertToSlug } from "../../../lib/stringUtils";

const CATEGORIES = [
  { slug: "sound-effects", name: "Sound Effects", extensions: [".mp3", ".wav", ".ogg"] },
  { slug: "music", name: "Music", extensions: [".mp3", ".wav", ".m4a"] },
  { slug: "video-meme", name: "Video Meme", extensions: [".mp4", ".mov", ".webm"] },
  { slug: "green-screen", name: "Green Screen", extensions: [".mp4", ".mov"] },
  { slug: "animation", name: "Animation", extensions: [".mp4", ".json", ".lottie"] },
  { slug: "image-overlay", name: "Image & Overlay", extensions: [".png", ".jpg", ".jpeg", ".gif", ".svg"] },
  { slug: "font", name: "Font", extensions: [".otf", ".ttf", ".woff", ".woff2"] },
  { slug: "preset-lut", name: "Preset & LUT", extensions: [".cube", ".xmp", ".prset"] },
];

export function useAdminUpload() {
  const [stagingFiles, setStagingFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const guessCategory = (fileName) => {
    const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
    const found = CATEGORIES.find((c) => c.extensions.includes(ext));
    return found ? found.slug : "";
  };

  const createStagingItem = useCallback((file, initialFolderId = null) => {
    const name = file.name;
    const displayName = cleanFileName(name);
    const category = guessCategory(name);

    return {
      id: Math.random().toString(36).substr(2, 9),
      rawFile: file,
      name: name,
      displayName: displayName,
      size: file.size,
      category: category,
      folderId: initialFolderId,
      tags: [],
      status: "pending", // pending, uploading, success, error
    };
  }, []);

  const addFiles = useCallback(async (files, folderId = null) => {
    const items = Array.from(files).map((f) => createStagingItem(f, folderId));
    setStagingFiles((prev) => [...prev, ...items]);
  }, [createStagingItem]);

  const updateFileMeta = useCallback((id, field, value) => {
    setStagingFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
  }, []);

  const updateBulkMeta = useCallback((updates) => {
    setStagingFiles((prev) =>
      prev.map((f) => {
        if (f.status === "success" || f.status === "uploading") return f;
        const newFile = { ...f };
        Object.entries(updates).forEach(([field, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            newFile[field] = value;
          }
        });
        return newFile;
      })
    );
  }, []);

  const removeFile = useCallback((id) => {
    setStagingFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setStagingFiles((prev) => prev.filter((f) => f.status !== "success"));
  }, []);

  const uploadAll = useCallback(async () => {
    // We update the local variable to avoid stale closures
    const toUpload = stagingFiles.filter(
      (f) => f.status === "pending" || f.status === "error"
    );
    
    console.log("Upload sequence started for:", toUpload.map(f => f.name));
    
    if (toUpload.length === 0) {
      console.log("No files to upload (pending or error status).");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    let completedCount = 0;

    for (const item of toUpload) {
      if (!item.category) {
        console.error("Missing category for file:", item.name);
        updateFileMeta(item.id, "status", "error");
        continue;
      }

      console.log(`Uploading: ${item.name} -> ${item.category}`);
      updateFileMeta(item.id, "status", "uploading");

      try {
        const path = generateStoragePath(item.category, item.name);
        const downloadUrl = await uploadFile(item.rawFile, path);

        const fileExtension = item.name.includes(".")
          ? item.name.split(".").pop()
          : "UNKNOWN";

        const resourceData = {
          name: item.displayName || item.name,
          slug: convertToSlug(item.displayName || item.name),
          category: item.category,
          folderId: item.folderId || null,
          tags: item.tags || [],
          fileName: item.name,
          fileSize: item.size,
          fileType: item.rawFile.type,
          fileFormat: fileExtension.toUpperCase(),
          downloadUrl: downloadUrl,
          storagePath: path,
          // Removed createdAt as it is handled by the server (serverTimestamp)
        };

        await addResource(resourceData);
        updateFileMeta(item.id, "status", "success");
        console.log(`Successfully finished: ${item.name}`);
      } catch (error) {
        console.error(`Failed to upload ${item.name}:`, error);
        updateFileMeta(item.id, "status", "error");
      }

      completedCount++;
      setUploadProgress(Math.round((completedCount / toUpload.length) * 100));
    }

    try {
      await revalidateResourceData();
      console.log("Global data revalidated.");
    } catch (e) {
      console.warn("Revalidation non-critical failure:", e);
    }
    
    setIsUploading(false);
  }, [stagingFiles, updateFileMeta]);

  return {
    stagingFiles,
    isUploading,
    uploadProgress,
    addFiles,
    updateFileMeta,
    updateBulkMeta,
    removeFile,
    clearCompleted,
    clearAll: () => setStagingFiles([]),
    uploadAll,
  };
}

