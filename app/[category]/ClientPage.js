"use client";

import { useState, useMemo, useEffect, useRef, useCallback, useTransition } from "react";
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
  const [isPending, startTransition] = useTransition();
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
  const isFirstRun = useRef(true);

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
    
    // Sync state from URL search params
    const folderId = searchParams.get("folder") || null;
    if (folderId !== selectedFolderId) {
      setSelectedFolderId(folderId);
      const result = findInTree(folders, folderId);
      setSelectedFolderName(result?.current ? (result.current.path || result.current.name) : null);
      setVisibleCount(PAGE_SIZE_DISPLAY);
    }
    
    const formatsStr = searchParams.get("format") || "";
    const currentFormatsStr = selectedFormats.join(",");
    if (formatsStr !== currentFormatsStr) {
      setSelectedFormats(formatsStr ? formatsStr.split(",") : []);
    }
    
    const tagsStr = searchParams.get("tags") || "";
    const currentTagsStr = selectedTags.join(",");
    if (tagsStr !== currentTagsStr) {
      setSelectedTags(tagsStr ? tagsStr.split(",") : []);
    }
    
    const sort = searchParams.get("sort") || "newest";
    if (sort !== sortBy) {
      setSortBy(sort);
    }
  }, [searchParams, isInitialized, folders]); // Removed startTransition here to ensure state sync is reliable

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
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();

    const refreshData = async () => {
      // Optimization: Skip the very first fetch on mount IF the state matches the initial server load
      if (hasLoadedInitialStateRef.current && isFirstRun.current) {
        isFirstRun.current = false;
        const hasNoFilters = !inPageSearch && selectedTags.length === 0 && selectedFormats.length === 0;
        const isAtRoot = selectedFolderId === null;
        
        if (initialResources?.length > 0 && hasNoFilters && isAtRoot) {
          console.log("🚀 Optimization: Skipping initial fetch, using server data.");
          setAllLoadedResources(initialResources);
          setServerOffset(initialResources.length);
          setIsFetchLoading(false);
          return;
        }
      }

      setIsFetchLoading(true);
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // When filtering (tags/search), we search the whole subtree of the current folder
      const isFiltering = inPageSearch || selectedFormats.length > 0 || selectedTags.length > 0 || resSlug;
      let folderIdToPass = selectedFolderId;
      
      if (isFiltering && selectedFolderId) {
        const node = findInTree(folders, selectedFolderId)?.current;
        if (node) {
          folderIdToPass = getDescendantIds(node);
        }
      }

      try {
        const fresh = await getResources({
          categorySlug: slug,
          selectedTags: selectedTags,
          selectedFormats: selectedFormats,
          folderId: folderIdToPass,
          searchTerm: inPageSearch,
          offset: 0,
          limit: PAGE_SIZE_BATCH,
          abortSignal: controller.signal
        });

        if (!controller.signal.aborted) {
          setAllLoadedResources(fresh || []);
          setServerOffset(fresh?.length || 0);
          setHasMoreDB(fresh?.length === PAGE_SIZE_BATCH);
          setVisibleCount(PAGE_SIZE_DISPLAY);
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error("Refresh fetch failed:", e);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsFetchLoading(false);
        }
      }
    };

    // Use 300ms debounce now that we have DB indexes for faster response
    debounceTimerRef.current = setTimeout(refreshData, 300);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [isInitialized, selectedFolderId, selectedFormats, selectedTags, sortBy, inPageSearch, slug]);

  // --- Folder Tags Fetching ---
  useEffect(() => {
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
  }, [selectedFolderId, selectedFormats, selectedTags, inPageSearch, slug, isInitialized, sortBy]);

  // Synchronize internal state with server-provided initialResources ONLY when category changes
  useEffect(() => {
    setAllLoadedResources(initialResources);
    setServerOffset(initialResources.length);
    setHasMoreDB(initialResources.length === PAGE_SIZE_BATCH);
    setVisibleCount(PAGE_SIZE_DISPLAY);
  }, [slug]);

  // --- Core Filtering (Now mostly sorting since search/tags are server-side) ---
  const filteredResources = useMemo(() => {
    let results = [...allLoadedResources];

    if (resSlug) {
      const target = results.find(r => r.slug === resSlug);
      if (target) return [target];
    }

    // Note: Search, Tags, and Formats are now filtered at the Server level via getResources.
    // allLoadedResources already contains the matching set.

    switch (sortBy) {
      case "popular":
        results.sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0));
        break;
      case "name":
        results.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        break;
      default:
        // Newest is handled by server sort order
        break;
    }
    return results;
  }, [allLoadedResources, sortBy, resSlug]);

  // Extract unique tags from loaded resources for FilterBar
  const availableTags = useMemo(() => {
    const isFiltered = selectedTags.length > 0 || inPageSearch || selectedFormats.length > 0;
    const tagMap = {};

    // 1. Calculate counts from currently loaded resources (respects current filters)
    allLoadedResources.forEach(r => {
      if (r.tags) {
        r.tags.forEach(t => {
          const lowTag = t.toLowerCase();
          tagMap[lowTag] = (tagMap[lowTag] || 0) + 1;
        });
      }
    });

    let baseTags = [];
    if (isFiltered) {
      // Show intersection + selected tags
      const tagsSet = new Set(selectedTags.map(t => t.toLowerCase()));
      Object.keys(tagMap).forEach(t => tagsSet.add(t));
      baseTags = Array.from(tagsSet);
    } else {
      // Default view for folder/category
      baseTags = selectedFolderId 
        ? (folderTags.length > 0 ? folderTags : []) 
        : categoryTags;
    }

    return baseTags.map(tag => {
      const lowName = tag.toLowerCase();
      return {
        name: lowName,
        count: tagMap[lowName] || 0
      };
    }).sort((a, b) => {
      const aSelected = selectedTags.includes(a.name);
      const bSelected = selectedTags.includes(b.name);
      
      // Primary: Selected tags first
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      
      // Secondary: Sort by count descending (most relevant first)
      if (a.count !== b.count) return b.count - a.count;
      
      // Tertiary: Alphabetical
      return a.name.localeCompare(b.name);
    });
  }, [allLoadedResources, selectedFolderId, categoryTags, folderTags, inPageSearch, selectedTags, selectedFormats]);

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
      return currentFolder 
        ? (currentFolder.totalResourceCount ?? currentFolder.resourceCount ?? 0) 
        : (info.resourceCount || 0);
    }
    return filteredResources.length;
  }, [currentFolder, info.resourceCount, inPageSearch, selectedFormats, selectedTags, filteredResources.length]);

  const breadcrumbs = useMemo(() => {
    const path = [];
    if (!selectedFolderId || folders.length === 0) return path;

    const findPath = (tree, targetId) => {
      for (const node of tree) {
        if (node.id === targetId) return [{ id: node.id, name: node.name }];
        if (node.children) {
          const subPath = findPath(node.children, targetId);
          if (subPath) return [{ id: node.id, name: node.name }, ...subPath];
        }
      }
      return null;
    };

    return findPath(folders, selectedFolderId) || [];
  }, [folders, selectedFolderId]);

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

      const isFiltering = inPageSearch || selectedFormats.length > 0 || selectedTags.length > 0 || resSlug;
      let folderIdToPass = selectedFolderId;
      if (isFiltering && selectedFolderId) {
        const node = findInTree(folders, selectedFolderId)?.current;
        if (node) {
          folderIdToPass = getDescendantIds(node);
        }
      }

      try {
        const nextBatch = await getResources({ 
          categorySlug: slug, 
          selectedTags: selectedTags,
          selectedFormats: selectedFormats,
          folderId: folderIdToPass,
          searchTerm: inPageSearch, // Important for infinite scroll in search results
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
    
    startTransition(() => {
      router.replace(finalUrl, { scroll: false });
    });
  }, [pathname, router, searchParams, startTransition]);

  const handleSelectFolder = (folder, isHistoryMove = false) => {
    const folderId = folder ? folder.id : null;
    const folderName = folder ? (folder.path || folder.name) : null;

    if (selectedFolderId === folderId) return;

    startTransition(() => {
      setSelectedFolderId(folderId);
      setSelectedFolderName(folderName);
      setVisibleCount(PAGE_SIZE_DISPLAY);
      setAllLoadedResources([]); // Immediate clear to avoid "Old resources + New folders" jitter
      setIsFetchLoading(true); // Force skeleton immediately
      
      updateUrl({ folder: folderId });

      // Update internal history stack if NOT moving via history buttons
      if (!isHistoryMove) {
        const newStack = historyStack.slice(0, historyPointer + 1);
        newStack.push(folderId);
        setHistoryStack(newStack);
        historyStackRef.current = newStack;
        setHistoryPointer(newStack.length - 1);
      }
    });
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
        const isAudio = info.layout === "audio" || info.layout === "sound";
        return Array.from({ length: 12 }).map((_, i) => (
          <div 
            key={`skeleton-${i}`} 
            className={isAudio ? styles.skeletonCardSound : styles.skeletonCard}
          >
            {isAudio ? (
              <>
                <div className={styles.skeletonThumbSound} />
                <div className={styles.skeletonInfoSound}>
                  <div className={styles.skeletonLine} style={{ width: "60%" }} />
                  <div className={styles.skeletonLine} style={{ width: "30%", opacity: 0.5 }} />
                </div>
              </>
            ) : (
              <>
                <div className={styles.skeletonThumb} />
                <div className={styles.skeletonCardBody}>
                  <div className={styles.skeletonLine} style={{ width: "80%" }} />
                  <div className={styles.skeletonLine} style={{ width: "40%", opacity: 0.5 }} />
                </div>
              </>
            )}
          </div>
        ));
      }


      // 2. Subfolders
      const isFiltering = inPageSearch || selectedFormats.length > 0 || selectedTags.length > 0 || resSlug;
      
      if (!isFiltering) {
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
      }

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
      <div className={styles.gridWrapper} style={{ minHeight: '800px' }}>
        <motion.div 
          className={gridClass}
          initial={false}
          animate={{
            filter: (isFetchLoading || isPending) ? "blur(8px) grayscale(0.2)" : "blur(0px) grayscale(0)",
            opacity: (isFetchLoading || isPending) ? 0.4 : 1,
          }}
          transition={{ duration: 0.3, ease: "easeOut" }}
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

        <div className={styles.pageHeader}>
          <div className={styles.navActions}>
            <button 
              className={styles.navBtn} 
              onClick={resetToRoot} 
              title="Home Root"
              disabled={selectedFolderId === null}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </button>
            <div className={styles.navArrows}>
              <button 
                className={styles.navBtn} 
                onClick={goBack} 
                disabled={historyPointer <= 0}
                title="Back"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <button 
                className={styles.navBtn} 
                onClick={goForward} 
                disabled={historyPointer >= historyStack.length - 1}
                title="Forward"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
          </div>
          
          <span className={styles.headerSep}>|</span>

          <h1 className={styles.title} style={{ color: info.color }}>
            {currentFolder ? currentFolder.name : info.name}
          </h1>
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
          onSearchChange={(val) => {
            setInPageSearch(val);
            // Search is typically local or debounced, no immediate URL update needed here
          }}
          resSlug={resSlug}
          onClearRes={() => router.push(pathname)}
          primaryColor={info.color}
          breadcrumbs={breadcrumbs}
          categoryName={info.name}
          onBreadcrumbClick={(id) => {
            if (!id) {
              handleSelectFolder(null);
            } else {
              const folder = findInTree(folders, id);
              if (folder?.current) handleSelectFolder(folder.current);
            }
          }}
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
