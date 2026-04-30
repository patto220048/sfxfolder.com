"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Sidebar from "@/app/components/layout/Sidebar";
import ResourceCard from "@/app/components/ui/ResourceCard";
import FolderCard from "@/app/components/ui/FolderCard";
import SoundButton from "@/app/components/ui/SoundButton";
import FilterBar from "@/app/components/ui/FilterBar";
import PreviewOverlay from "@/app/components/ui/PreviewOverlay";
import { getResources, getResourceBySlug } from "@/app/lib/api";
import styles from "./page.module.css";

const PAGE_SIZE_DISPLAY = 24;
const PAGE_SIZE_BATCH = 200;

const findInTree = (nodes, targetId, parent = null) => {
  if (!nodes || !targetId) return null;
  for (const node of nodes) {
    if (node.id === targetId) return { current: node, parent };
    if (node.children?.length > 0) {
      const result = findInTree(node.children, targetId, node);
      if (result) return result;
    }
  }
  return null;
};

const getDescendantIds = (node) => {
  let ids = [node.id];
  if (node.children) {
    node.children.forEach(child => {
      ids = [...ids, ...getDescendantIds(child)];
    });
  }
  return ids;
};

export default function ClientPage({ slug, info, folders, resources: initialResources, categoryTags = [] }) {
  // --- States ---
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [selectedFolderName, setSelectedFolderName] = useState(null);
  const [selectedFormats, setSelectedFormats] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [sortBy, setSortBy] = useState("newest");
  const [isInitialized, setIsInitialized] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE_DISPLAY);

  // Folder History (internal navigation only, not browser history)
  const [historyStack, setHistoryStack] = useState([]);
  const [historyPointer, setHistoryPointer] = useState(-1);
  const historyStackRef = useRef([]);
  const isInternalNavRef = useRef(false);
  const hasLoadedInitialStateRef = useRef(false);
  const prevSlugRef = useRef(slug);
  
  // Resources State
  const [allLoadedResources, setAllLoadedResources] = useState(initialResources);
  const [serverOffset, setServerOffset] = useState(initialResources.length);
  const [hasMoreDB, setHasMoreDB] = useState(initialResources.length === PAGE_SIZE_BATCH);
  const [isFetchLoading, setIsFetchLoading] = useState(false);
  
  const [previewResource, setPreviewResource] = useState(null);
  const [inPageSearch, setInPageSearch] = useState("");
  const [folderTags, setFolderTags] = useState([]);
  
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

    // 3. Apply initial state with reference checks to prevent loops
    if (initialFolderId) {
      setSelectedFolderId(initialFolderId);
      const result = findInTree(folders, initialFolderId);
      if (result?.current) {
        setSelectedFolderName(result.current.path || result.current.name);
      }
    } else {
      setSelectedFolderId(null);
      setSelectedFolderName(null);
    }

    // 4. Initialize history stack ONLY ONCE (or when category changes)
    if (!hasLoadedInitialStateRef.current || prevSlugRef.current !== slug) {
      const initialStack = initialFolderId ? [initialFolderId] : [null];
      setHistoryStack(initialStack);
      historyStackRef.current = initialStack;
      setHistoryPointer(0);
      hasLoadedInitialStateRef.current = true;
      prevSlugRef.current = slug;
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

  // Sync URL changes back to local state (supports browser back/forward)
  useEffect(() => {
    if (!isInitialized) return;
    
    const folderId = searchParams.get("folder") || null;
    if (folderId !== selectedFolderId) {
      setSelectedFolderId(folderId);
      const result = findInTree(folders, folderId);
      setSelectedFolderName(result?.current ? (result.current.path || result.current.name) : null);
      setVisibleCount(PAGE_SIZE_DISPLAY);

      // CRITICAL: Sync historyPointer if the URL changed (browser back/forward)
      const existingIdx = historyStackRef.current.indexOf(folderId);
      if (existingIdx !== -1) {
        setHistoryPointer(existingIdx);
      } else {
        setHistoryStack(prev => {
          const next = [...prev, folderId];
          historyStackRef.current = next;
          return next;
        });
        setHistoryPointer(historyStackRef.current.length - 1);
      }
    }
    
    const formats = searchParams.get("format") ? searchParams.get("format").split(",") : [];
    if (JSON.stringify(formats) !== JSON.stringify(selectedFormats)) {
      setSelectedFormats(formats);
    }
    
    const tags = searchParams.get("tags") ? searchParams.get("tags").split(",") : [];
    if (JSON.stringify(tags) !== JSON.stringify(selectedTags)) {
      setSelectedTags(tags);
    }
    
    const sort = searchParams.get("sort") || "newest";
    if (sort !== sortBy) {
      setSortBy(sort);
    }
  }, [searchParams, isInitialized, folders]);

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

    // Sync explicitly to localStorage whenever these change
    try {
      localStorage.setItem(`last_state_${slug}`, JSON.stringify({
        folderId: selectedFolderId,
        formats: selectedFormats,
        tags: selectedTags,
        sort: sortBy
      }));
    } catch (e) {
      console.warn("Save to localStorage failed:", e);
    }

    // --- Data Refresh Logic ---
    // Instead of clearing to [] and causing a jumpy flicker, 
    // we use isFetchLoading to trigger a smooth Blur/Dim animation 
    // while the new data is pending.
    setIsFetchLoading(true);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();

    const refreshData = async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

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

        if (!controller.signal.aborted) {
          // Clear items right before setting new ones for a crisp replacement
          setAllLoadedResources(fresh);
          setServerOffset(fresh.length);
          setHasMoreDB(fresh.length === PAGE_SIZE_BATCH);
          setVisibleCount(PAGE_SIZE_DISPLAY);
        }
      } catch (err) {
        if (err.name !== 'AbortError') console.error("Failed to refresh resources:", err);
      } finally {
        if (!controller.signal.aborted) setIsFetchLoading(false);
      }
    };

    debounceTimerRef.current = setTimeout(refreshData, 300);

    // --- Folder Tags Fetching ---
    // If we are in a folder, fetch tags for this folder and its descendants
    if (selectedFolderId) {
      const node = findInTree(folders, selectedFolderId)?.current;
      if (node) {
        const allSubFolderIds = getDescendantIds(node);
        import("@/app/lib/api").then(api => {
          api.getCategoryTags(slug, allSubFolderIds).then(tags => {
            setFolderTags(tags);
          });
        });
      }
    } else {
      setFolderTags([]);
    }

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [selectedFolderId, selectedFormats, selectedTags, slug, isInitialized, sortBy]);

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

    // Filter by folderId locally if not searching or filtering tags/formats
    const isGlobalAction = resSlug || inPageSearch || selectedFormats.length > 0 || selectedTags.length > 0;
    if (!isGlobalAction) {
      results = results.filter(r => r.folderId === selectedFolderId);
    }

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
    // 1. If searching, calculate tags dynamically from results
    if (inPageSearch) {
      const tags = new Set();
      filteredResources.forEach(r => {
        if (r.tags) r.tags.forEach(t => tags.add(t.toLowerCase()));
      });
      return Array.from(tags).sort();
    }

    // 2. If in a folder, use the pre-fetched recursive folder tags
    if (selectedFolderId) {
      // If folderTags haven't loaded yet, fallback to what we have in allLoadedResources
      if (folderTags.length > 0) return folderTags;
      
      const tags = new Set();
      allLoadedResources.forEach(r => {
        if (r.tags) r.tags.forEach(t => tags.add(t.toLowerCase()));
      });
      return Array.from(tags).sort();
    }

    // 3. If at root, show all category tags
    return categoryTags;
  }, [allLoadedResources, filteredResources, selectedFolderId, categoryTags, folderTags, inPageSearch]);

  // --- Folder Navigation Grid Logic ---
  const { currentSubfolders, parentFolder } = useMemo(() => {
    if (!selectedFolderId) {
      return { currentSubfolders: folders, parentFolder: null };
    }

    const result = findInTree(folders, selectedFolderId);
    return {
      currentSubfolders: result?.current?.children || [],
      parentFolder: result?.parent || "root" // "root" string to represent back to All
    };
  }, [folders, selectedFolderId]);
  
  const currentFolder = useMemo(() => {
    if (!selectedFolderId) return null;
    return findInTree(folders, selectedFolderId)?.current;
  }, [folders, selectedFolderId]);

  const countToDisplay = useMemo(() => {
    if (!inPageSearch && selectedFormats.length === 0 && selectedTags.length === 0) {
      return currentFolder ? (currentFolder.resourceCount || 0) : (info.resourceCount || 0);
    }
    return filteredResources.length;
  }, [currentFolder, info.resourceCount, inPageSearch, selectedFormats, selectedTags, filteredResources.length]);

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

  const updateUrl = useCallback((updates) => {
    const params = new URLSearchParams(searchParams.toString());
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
        params.delete(key);
      } else {
        params.set(key, Array.isArray(value) ? value.join(",") : value);
      }
    });

    const queryString = params.toString();
    const finalUrl = `${pathname}${queryString ? `?${queryString}` : ""}`;
    router.replace(finalUrl, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleSelectFolder = (folder, isHistoryMove = false) => {
    const folderId = folder ? folder.id : null;
    const folderName = folder ? (folder.path || folder.name) : null;

    if (selectedFolderId === folderId) return;

    setSelectedFolderId(folderId);
    setSelectedFolderName(folderName);
    setVisibleCount(PAGE_SIZE_DISPLAY);
    
    updateUrl({ folder: folderId });

    // Update internal history stack if NOT moving via history buttons
    if (!isHistoryMove) {
      const newStack = historyStack.slice(0, historyPointer + 1);
      newStack.push(folderId);
      setHistoryStack(newStack);
      historyStackRef.current = newStack;
      setHistoryPointer(newStack.length - 1);
    }
  };

  const goBack = () => {
    if (historyPointer > 0) {
      const prevId = historyStack[historyPointer - 1];
      const folder = findInTree(folders, prevId);
      setHistoryPointer(prev => prev - 1);
      handleSelectFolder(folder?.current || null, true);
    }
  };

  const goForward = () => {
    if (historyPointer < historyStack.length - 1) {
      const nextId = historyStack[historyPointer + 1];
      const folder = findInTree(folders, nextId);
      setHistoryPointer(prev => prev + 1);
      handleSelectFolder(folder?.current || null, true);
    }
  };

  const resetToRoot = () => {
    handleSelectFolder(null);
  };

  const renderResources = () => {
    const displayResources = filteredResources.slice(0, visibleCount);
    const hasCurrentFolders = currentSubfolders.length > 0 || parentFolder;

    if (filteredResources.length === 0 && !isFetchLoading && !hasCurrentFolders) {
      return (
        <div className={styles.empty}>
          <p>
            No resources found{selectedFolderName ? ` in "${selectedFolderName}"` : ""}.
          </p>
        </div>
      );
    }

    // Prepare Grid Content (Subfolders + Back Button + Resources)
    const renderGridItems = () => {
      const items = [];
      let globalIdx = 0;

      // 1. ADD SKELETONS if loading (this hides the gap better than empty grid)
      if (isFetchLoading && filteredResources.length === 0) {
        return Array.from({ length: 8 }).map((_, i) => (
          <div key={`skeleton-${i}`} className={styles.skeletonCard}>
            <div className={styles.skeletonThumb} />
            <div className={styles.skeletonCardBody}>
              <div style={{ height: "14px", width: "80%", background: "var(--text-primary)", opacity: 0.1, borderRadius: "2px" }} />
              <div style={{ height: "10px", width: "40%", background: "var(--text-primary)", opacity: 0.05, borderRadius: "2px" }} />
            </div>
          </div>
        ));
      }


      // 2. Subfolders
      currentSubfolders.forEach((sub) => {
        items.push(
          <FolderCard
            key={sub.id}
            folder={sub}
            onClick={() => handleSelectFolder(sub)}
            primaryColor={info.color}
            index={globalIdx++}
          />
        );
      });

      // 3. Resources
      // Condition: Hide resources at root if there are folders AND no active search/filters
      const isRootNoFilters = !selectedFolderId && !inPageSearch && selectedFormats.length === 0 && selectedTags.length === 0;
      const hasFoldersAtRoot = folders.length > 0;
      
      if (isRootNoFilters && hasFoldersAtRoot) {
        return items; // Skip resources, return only folders
      }

      if (info.layout === "audio" || info.layout === "sound") {
        displayResources.forEach((resource) => {
          items.push(
            <SoundButton
              key={resource.id}
              {...resource}
              downloadUrl={resource.downloadUrl || resource.fileUrl}
              index={globalIdx++ % PAGE_SIZE_DISPLAY}
              onPreview={() => resource.slug ? router.push(`/${slug}/${resource.slug}`) : setPreviewResource(resource)}
              primaryColor={info.color}
            />
          );
        });
      } else {
        displayResources.forEach((resource) => {
          items.push(
            <ResourceCard
              key={resource.id}
              {...resource}
              downloadUrl={resource.downloadUrl || resource.fileUrl}
              cardType={
                info.layout === "font" ? "font" :
                info.layout === "video" || info.layout === "image" ? info.layout :
                slug === "image-overlay" ? "image" :
                slug === "preset-lut" ? "preview" : "video"
              }
              index={globalIdx++ % PAGE_SIZE_DISPLAY}
              onPreview={() => setPreviewResource(resource)}
              detailUrl={resource.slug ? `/${slug}/${resource.slug}` : null}
              primaryColor={info.color}
            />
          );
        });
      }

      return items;
    };

    const gridClass = (info.layout === "audio" || info.layout === "sound") ? styles.soundGrid : styles.grid;

    return (
      <div className={styles.gridWrapper}>
        <motion.div 
          className={gridClass}
          initial={false}
          animate={{
            filter: isFetchLoading ? "blur(12px) grayscale(0.2)" : "blur(0px) grayscale(0)",
            opacity: isFetchLoading ? 0.3 : 1,
            scale: isFetchLoading ? 0.98 : 1
          }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          {renderGridItems()}
        </motion.div>
        
        {/* Skeleton Overlay - perfectly aligned with the blur area */}
        {isFetchLoading && (
          <div 
            className={gridClass} 
            style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              width: '100%', 
              pointerEvents: 'none', 
              zIndex: 10,
              opacity: 0.8
            }}
          >
            {Array.from({ length: 12 }).map((_, i) => {
              const isSoundLayout = gridClass === styles.soundGrid;
              if (isSoundLayout) {
                return (
                  <div key={`overlay-skeleton-${i}`} className={styles.skeletonCardSound}>
                    <div className={styles.skeletonThumbSound} />
                    <div className={styles.skeletonInfoSound}>
                      <div className={styles.skeletonLine} style={{ width: '80%' }} />
                      <div className={styles.skeletonLine} style={{ width: '40%' }} />
                    </div>
                  </div>
                );
              }
              return (
                <div key={`overlay-skeleton-${i}`} className={styles.skeletonCard}>
                  <div className={styles.skeletonThumb} />
                  <div className={styles.skeletonCardBody}>
                    <div className={styles.skeletonLine} style={{ width: '90%' }} />
                    <div className={styles.skeletonLine} style={{ width: '40%' }} />
                    <div className={styles.skeletonLine} style={{ width: '60%', marginTop: 'auto' }} />
                  </div>
                  <div className={styles.skeletonAction} />
                </div>
              );
            })}
          </div>
        )}
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
      </div>
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
          {currentFolder ? currentFolder.name : info.name}
          {countToDisplay > 0 && ` (${countToDisplay})`}
        </h1>

        <div className={styles.navActions}>
          <button 
            className={styles.navBtn} 
            onClick={resetToRoot} 
            title="Home Root"
            disabled={selectedFolderId === null}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </button>
          <div className={styles.navArrows}>
            <button 
              className={styles.navBtn} 
              onClick={goBack} 
              disabled={historyPointer <= 0}
              title="Back"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <button 
              className={styles.navBtn} 
              onClick={goForward} 
              disabled={historyPointer >= historyStack.length - 1}
              title="Forward"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </div>

        <FilterBar
          formats={info.formats}
          selectedFormats={selectedFormats}
          onFormatsChange={(vals) => {
            setSelectedFormats(vals);
            updateUrl({ format: vals });
          }}
          tags={availableTags}
          selectedTags={selectedTags}
          onTagsChange={(vals) => {
            setSelectedTags(vals);
            updateUrl({ tags: vals });
          }}
          sortBy={sortBy}
          onSortChange={(val) => {
            setSortBy(val);
            updateUrl({ sort: val });
          }}
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
