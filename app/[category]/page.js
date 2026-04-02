"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import Sidebar from "@/app/components/layout/Sidebar";
import ResourceCard from "@/app/components/ui/ResourceCard";
import FilterBar from "@/app/components/ui/FilterBar";
import styles from "./page.module.css";

const CATEGORY_INFO = {
  "sound-effects": { name: "Sound Effects", color: "#00F0FF", formats: ["mp3", "wav", "ogg"] },
  music: { name: "Music", color: "#A855F7", formats: ["mp3", "wav", "flac"] },
  "video-meme": { name: "Video Meme", color: "#FBBF24", formats: ["mp4", "webm", "gif"] },
  "green-screen": { name: "Green Screen", color: "#22C55E", formats: ["mp4", "mov", "webm"] },
  animation: { name: "Animation", color: "#F43F5E", formats: ["mp4", "gif", "webm"] },
  "image-overlay": { name: "Image & Overlay", color: "#F97316", formats: ["png", "jpg", "webp"] },
  font: { name: "Font", color: "#E2E8F0", formats: ["ttf", "otf", "woff2"] },
  "preset-lut": { name: "Preset & LUT", color: "#6366F1", formats: ["cube", "xmp", "lut"] },
};

export default function CategoryPage() {
  const params = useParams();
  const slug = params.category;
  const info = CATEGORY_INFO[slug] || { name: slug, color: "#00F0FF", formats: [] };

  const [folders, setFolders] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [sortBy, setSortBy] = useState("newest");

  // Fetch folders from Firestore
  useEffect(() => {
    async function loadFolders() {
      try {
        const ref = collection(db, "folders");
        const q = query(ref, where("categorySlug", "==", slug));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => (a.order || 0) - (b.order || 0));
        setFolders(data);
      } catch (e) {
        console.error("Failed to load folders:", e.message);
      }
    }
    loadFolders();
  }, [slug]);

  // Fetch resources from Firestore
  useEffect(() => {
    async function loadResources() {
      setLoading(true);
      try {
        const ref = collection(db, "resources");
        const constraints = [
          where("category", "==", slug),
          where("isPublished", "==", true),
        ];
        if (selectedFolder) {
          constraints.push(where("folder", "==", selectedFolder));
        }
        const q = query(ref, ...constraints);
        const snapshot = await getDocs(q);
        setResources(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Failed to load resources:", e.message);
      }
      setLoading(false);
    }
    loadResources();
  }, [slug, selectedFolder]);

  const filteredResources = useMemo(() => {
    let results = [...resources];

    if (selectedFormat) {
      results = results.filter((r) => r.fileFormat === selectedFormat);
    }

    switch (sortBy) {
      case "popular":
        results.sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0));
        break;
      case "name":
        results.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default: // newest
        break;
    }

    return results;
  }, [resources, selectedFormat, sortBy]);

  return (
    <div className={styles.page}>
      <Sidebar
        categoryName={info.name}
        folders={folders}
        selectedPath={selectedFolder}
        onSelectFolder={setSelectedFolder}
      />

      <div className={styles.main}>
        {/* Breadcrumb */}
        <div className={styles.breadcrumb}>
          <span className={styles.breadcrumbItem}>{info.name}</span>
          {selectedFolder && (
            <>
              {selectedFolder.split("/").map((part, idx) => (
                <span key={idx}>
                  <span className={styles.breadcrumbSep}>/</span>
                  <span className={styles.breadcrumbItem}>{part}</span>
                </span>
              ))}
            </>
          )}
        </div>

        <h1 className={styles.title} style={{ color: info.color }}>
          {info.name}
        </h1>

        <FilterBar
          formats={info.formats}
          selectedFormat={selectedFormat}
          onFormatChange={setSelectedFormat}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        {loading ? (
          <div className={styles.empty}>
            <p>Loading resources...</p>
          </div>
        ) : (
          <>
            <div className={styles.grid}>
              {filteredResources.map((resource, idx) => (
                <ResourceCard key={resource.id} {...resource} index={idx} />
              ))}
            </div>

            {filteredResources.length === 0 && (
              <div className={styles.empty}>
                <p>No resources found{selectedFolder ? ` in "${selectedFolder}"` : ""}.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
