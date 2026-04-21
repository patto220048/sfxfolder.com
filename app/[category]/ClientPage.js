"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Sidebar from "@/app/components/layout/Sidebar";
import ResourceCard from "@/app/components/ui/ResourceCard";
import SoundButton from "@/app/components/ui/SoundButton";
import FilterBar from "@/app/components/ui/FilterBar";
import PreviewOverlay from "@/app/components/ui/PreviewOverlay";
import { getResources, getResourceBySlug } from "@/app/lib/api";
import styles from "./page.module.css";

const PAGE_SIZE_DISPLAY = 24;
const PAGE_SIZE_BATCH = 200;

export default function ClientPage({ slug, info, folders, resources: initialResources }) {
  // --- States ---
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [selectedFolderName, setSelectedFolderName] = useState(null);
  const [selectedFormats, setSelectedFormats] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [sortBy, setSortBy] = useState("newest");
  const [isInitialized, setIsInitialized] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE_DISPLAY);
  
  // Resources State
  const [allLoadedResources, setAllLoadedResources] = useState(initialResources);
  const [serverOffset, setServerOffset] = useState(initialResources.length);
  const [hasMoreDB, setHasMoreDB] = useState(initialResources.length === PAGE_SIZE_BATCH);
  const [isFetchLoading, setIsFetchLoading] = useState(false);
  
  const [previewResource, setPreviewResource] = useState(null);
  const [inPageSearch, setInPageSearch] = useState("");
  
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const resSlug = searchParams.get("res");
  const loadMoreRef = useRef(null);
  const abortControllerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // --- Effects ---

  // Initialize state from URL or LocalStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Try URL first
    const urlFolderId = searchParams.get("folder");
    const urlFormat = searchParams.get("format");
    const urlTags = searchParams.get("tags");
    const urlSort = searchParams.get("sort");

    let initialFolderId = urlFolderId;
    let initialFormats = urlFormat ? urlFormat.split(",") : [];
    let initialTags = urlTags ? urlTags.split(",") : [];
    let initialSort = urlSort || "newest";

    // 2. If URL is incomplete, try LocalStorage
    if (!urlFolderId || !urlFormat || !urlSort) {
      try {
        const saved = localStorage.getItem(`last_state_${slug}`);
        if (saved) {
          const data = JSON.parse(saved);
          if (!urlFolderId && data.folderId) initialFolderId = data.folderId;
          if (!urlFormat && data.formats) initialFormats = data.formats;
          if (!urlTags && data.tags) initialTags = data.tags;
          if (!urlSort && data.sort) initialSort = data.sort;
        }
      } catch (e) {
        console.warn("Failed to load state from localStorage:", e);
      }
    }

    // Apply initial state with reference checks to prevent loops
    if (initialFolderId && initialFolderId !== selectedFolderId) {
      setSelectedFolderId(initialFolderId);
      const folder = folders.find(f => f.id === initialFolderId);
      if (folder) setSelectedFolderName(folder.path || folder.name);
    }
    
    if (initialFormats.length > 0 && JSON.stringify(initialFormats) !== JSON.stringify(selectedFormats)) {
      setSelectedFormats(initialFormats);
    }

    if (initialTags.length > 0 && JSON.stringify(initialTags) !== JSON.stringify(selectedTags)) {
      setSelectedTags(initialTags);
    }

    if (initialSort && initialSort !== sortBy) {
      setSortBy(initialSort);
    }
    
    setIsInitialized(true);
  }, [slug, folders]); // Keep dependencies stable. searchParams is intentionally excluded to avoid loops on URL change.

  // Sync state changes back to URL and LocalStorage
  useEffect(() => {
    if (!isInitialized || typeof window === 'undefined') return;

    const params = new URLSearchParams(searchParams.toString());
    
    if (selectedFolderId) params.set("folder", selectedFolderId);
    else params.delete("folder");
    
    if (selectedFormats.length > 0) params.set("format", selectedFormats.join(","));
    else params.delete("format");

    if (selectedTags.length > 0) params.set("tags", selectedTags.join(","));
    else params.delete("tags");
    
    if (sortBy && sortBy !== "newest") params.set("sort", sortBy);
    else params.delete("sort");

    const queryString = params.toString();
    const currentQuery = searchParams.toString();
    
    // ONLY replace if the query actually changed to avoid infinite re-render loops
    if (queryString !== currentQuery) {
      const finalUrl = `${pathname}${queryString ? `?${queryString}` : ""}`;
      router.replace(finalUrl, { scroll: false });
    }

    // Update LocalStorage for cross-category memory
    try {
      localStorage.setItem(`last_state_${slug}`, JSON.stringify({
        folderId: selectedFolderId,
        formats: selectedFormats,
        tags: selectedTags,
        sort: sortBy
      }));
    } catch (e) {
      console.warn("Failed to save state to localStorage:", e);
    }
  }, [selectedFolderId, selectedFormats, selectedTags, sortBy, isInitialized, pathname, router, slug]);

  // Handle deep-link to resource via ?res=slug
  useEffect(() => {
    if (!isInitialized || !resSlug) return;
    
    const existing = allLoadedResources.find(r => r.slug === resSlug);
    if (!existing) {
      // If not in current pool, fetch it specifically
      getResourceBySlug(resSlug).then(resource => {
        if (resource) {
          setAllLoadedResources(prev => [resource, ...prev]);
        }
      });
    }
  }, [resSlug, allLoadedResources, isInitialized]);

  // Listen for in-page search from ContextSearch
  useEffect(() => {
    const handleLocalSearch = (e) => {
      setInPageSearch(e.detail || "");
    };
    window.addEventListener("local-search", handleLocalSearch);
    return () => window.removeEventListener("local-search", handleLocalSearch);
  }, []);

  // Reset when primary filters change with DEBOUNCE and ABORT
  useEffect(() => {
    if (!isInitialized) return;

    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Cancel any ongoing fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const refreshData = async () => {
      // Create new abort controller
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsFetchLoading(true);
      try {
        const fresh = await getResources({
          categorySlug: slug,
          selectedTags: selectedTags,
          selectedFormats: selectedFormats,
          folderId: selectedFolderId,
          offset: 0,
          limit: PAGE_SIZE_BATCH,
          abortSignal: controller.signal
        });

        // Only update state if this request hasn't been aborted
        if (!controller.signal.aborted) {
          setAllLoadedResources(fresh);
          setServerOffset(fresh.length);
          setHasMoreDB(fresh.length === PAGE_SIZE_BATCH);
          setVisibleCount(PAGE_SIZE_DISPLAY);
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log("Fetch aborted for filter change");
        } else {
          console.error("Failed to refresh resources:", err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsFetchLoading(false);
        }
      }
    };

    // Set debounce timer
    debounceTimerRef.current = setTimeout(() => {
      refreshData();
    }, 300); // 300ms debounce

    // Cleanup on unmount or next effect run
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      // We don't necessarily want to abort here if the component is still mounted 
      // but the effect is re-running due to state change, 
      // because we already handle that at the start of the next effect.
    };
  }, [selectedFolderId, selectedFormats, selectedTags, slug, isInitialized]);

  // Synchronize internal state with server-provided initialResources ONLY when category changes
  useEffect(() => {
    setAllLoadedResources(initialResources);
    setServerOffset(initialResources.length);
    setHasMoreDB(initialResources.length === PAGE_SIZE_BATCH);
    setVisibleCount(PAGE_SIZE_DISPLAY);
  }, [slug]);

  // --- Core Filtering ---
  const filteredResources = useMemo(() => {
    let results = [...allLoadedResources];

    if (resSlug) {
      const target = results.find(r => r.slug === resSlug);
      if (target) return [target];
    }

    // folderId, selectedFormats, and selectedTags are now filtered at the server level
    // so we don't need to filter them locally here, which avoids the infinite loop.

    if (inPageSearch) {
      const q = inPageSearch.toLowerCase();
      results = results.filter(r => 
        r.name?.toLowerCase().includes(q) || 
        r.tags?.some(t => t.toLowerCase().includes(q))
      );
    }

    switch (sortBy) {
      case "popular":
        results.sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0));
        break;
      case "name":
        results.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        break;
      default:
        // Default to newest if the server results are already ordered, 
        // or add explicit sort if needed.
        break;
    }
    return results;
  }, [allLoadedResources, sortBy, inPageSearch, resSlug]);

  // Extract unique tags from loaded resources for FilterBar
  const availableTags = useMemo(() => {
    const tags = new Set();
    allLoadedResources.forEach(r => {
      if (r.tags) r.tags.forEach(t => tags.add(t.toLowerCase()));
    });
    return Array.from(tags).sort();
  }, [allLoadedResources]);

  // --- Pagination Logic ---

  const handleLoadMore = useCallback(async () => {
    if (isFetchLoading) return;

    // SAFETY GUARD: If we have no more DB items AND we've shown all local items, stop.
    if (!hasMoreDB && visibleCount >= filteredResources.length) return;

    // 1. Check if we have more in our LOCAL pool of loaded resources
    if (visibleCount + PAGE_SIZE_DISPLAY <= filteredResources.length) {
      setVisibleCount(prev => prev + PAGE_SIZE_DISPLAY);
      return;
    }

    // 2. If we are near the end of the local pool AND the server might have more
    if (hasMoreDB) {
      setIsFetchLoading(true);
      try {
        const nextBatch = await getResources({ 
          categorySlug: slug, 
          selectedTags: selectedTags,
          selectedFormats: selectedFormats,
          folderId: selectedFolderId,
          offset: serverOffset, 
          limit: PAGE_SIZE_BATCH 
        });

        if (nextBatch.length > 0) {
          setAllLoadedResources(prev => [...prev, ...nextBatch]);
          setServerOffset(prev => prev + nextBatch.length);
          // If we got fewer than requested, we've hit the end
          if (nextBatch.length < PAGE_SIZE_BATCH) {
            setHasMoreDB(false);
          }
          // Increment visibility
          setVisibleCount(prev => prev + PAGE_SIZE_DISPLAY);
        } else {
          setHasMoreDB(false);
        }
      } catch (err) {
        console.error("Failed to fetch more resources:", err);
      } finally {
        setIsFetchLoading(false);
      }
    } else {
      // Just show remaining if any
      if (visibleCount < filteredResources.length) {
        setVisibleCount(filteredResources.length);
      }
    }
  }, [isFetchLoading, visibleCount, filteredResources.length, hasMoreDB, slug, serverOffset]);

  // --- Infinite Scroll Observer ---
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, [handleLoadMore]);

  const handleSelectFolder = (folder) => {
    if (folder === null) {
      setSelectedFolderId(null);
      setSelectedFolderName(null);
    } else {
      setSelectedFolderId(folder.id);
      setSelectedFolderName(folder.path || folder.name);
    }
  };

  const renderResources = () => {
    if (filteredResources.length === 0 && !isFetchLoading) {
      return (
        <div className={styles.empty}>
          <p>
            No resources found{selectedFolderName ? ` in "${selectedFolderName}"` : ""}.
          </p>
        </div>
      );
    }

    const displayResources = filteredResources.slice(0, visibleCount);

    let gridContent;
    if (info.layout === "audio" || info.layout === "sound") {
      gridContent = (
        <div className={styles.soundGrid}>
          {displayResources.map((resource, idx) => (
            <SoundButton
              key={resource.id}
              {...resource}
              downloadUrl={resource.downloadUrl || resource.fileUrl}
              index={idx % PAGE_SIZE_DISPLAY}
              onPreview={() => setPreviewResource(resource)}
              primaryColor={info.color}
            />
          ))}
        </div>
      );
    } else if (info.layout === "font") {
      gridContent = (
        <div className={styles.grid}>
          {displayResources.map((resource, idx) => (
            <ResourceCard
              key={resource.id}
              {...resource}
              downloadUrl={resource.downloadUrl || resource.fileUrl}
              cardType="font"
              index={idx % PAGE_SIZE_DISPLAY}
              onPreview={() => setPreviewResource(resource)}
            />
          ))}
        </div>
      );
    } else {
      gridContent = (
        <div className={styles.grid}>
          {displayResources.map((resource, idx) => (
            <ResourceCard
              key={resource.id}
              {...resource}
              downloadUrl={resource.downloadUrl || resource.fileUrl}
              cardType={
                info.layout === "video" || info.layout === "image"
                  ? info.layout
                  : slug === "image-overlay"
                  ? "image"
                  : slug === "preset-lut"
                  ? "preview"
                  : "video"
              }
              index={idx % PAGE_SIZE_DISPLAY}
              onPreview={() => setPreviewResource(resource)}
              primaryColor={info.color}
            />
          ))}
        </div>
      );
    }

    return (
      <>
        {gridContent}
        
        {/* Sentinel element for Infinite Scroll */}
        <div ref={loadMoreRef} className={styles.observerSentinel}>
          {(isFetchLoading || (visibleCount < filteredResources.length) || hasMoreDB) && (
            <div className={styles.loadMoreWrapper}>
              <div className={styles.infiniteLoader}>
                <span className={styles.loaderIcon}></span>
                <span>Optimizing your creative flow...</span>
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <div className={styles.page} style={{ "--cat-color": info.color }}>
      <Sidebar
        categoryName={info.name}
        folders={folders}
        selectedFolderId={selectedFolderId}
        onSelectFolder={handleSelectFolder}
        primaryColor={info.color}
      />

      <div className={styles.main}>
        <div className={styles.breadcrumb}>
          <span className={styles.breadcrumbItem}>{info.name}</span>
          {selectedFolderName && (
            <>
              {selectedFolderName.split("/").map((part, idx) => (
                <span key={idx}>
                  <span className={styles.breadcrumbSep}>/</span>
                  <span className={styles.breadcrumbItem}>{part}</span>
                </span>
              ))}
            </>
          )}
        </div>

        <h1 className={styles.title} style={{ color: info.color }}>
          {info.name} ({filteredResources.length})
        </h1>

        <FilterBar
          formats={info.formats}
          selectedFormats={selectedFormats}
          onFormatsChange={setSelectedFormats}
          tags={availableTags}
          selectedTags={selectedTags}
          onTagsChange={setSelectedTags}
          sortBy={sortBy}
          onSortChange={setSortBy}
          inPageSearch={inPageSearch}
          onSearchChange={setInPageSearch}
          resSlug={resSlug}
          onClearRes={() => router.push(pathname)}
          primaryColor={info.color}
        />

        {renderResources()}
      </div>

      {previewResource && (
        <PreviewOverlay 
          resource={previewResource} 
          onClose={() => setPreviewResource(null)} 
          showDownload={true} 
        />
      )}
    </div>
  );
}
