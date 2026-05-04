"use client";

import { useState, useMemo, useEffect, useRef, useCallback, useTransition, useDeferredValue, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useSidebar } from "@/app/context/SidebarContext";
import { useSiteData } from "@/app/context/SiteContext";
import { Volume2, Music, Camera, Layers, Video, Folder } from "lucide-react";
import useSWR from "swr";
import { useDebounce } from "@/app/hooks/useDebounce";

import dynamic from "next/dynamic";
const PreviewOverlay = dynamic(() => import("@/app/components/ui/PreviewOverlay"));
import { getResources, getResourceBySlug, getCategoryTags } from "@/app/lib/api";
import { mediaManager } from "@/app/lib/mediaManager";

// Sub-components
import NavigationHeader from "./components/NavigationHeader";
import FilterSection from "./components/FilterSection";
import ResourceGrid from "./components/ResourceGrid";
import Sidebar from "@/app/components/layout/Sidebar";

import styles from "./page.module.css";

const PAGE_SIZE_DISPLAY = 24;
const PAGE_SIZE_BATCH = 50;

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

function ClientPageContent({ slug, info, folders, resources: initialResources, categoryTags = [], isPlugin: propIsPlugin = false }) {
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [selectedFolderName, setSelectedFolderName] = useState(null);
  const [selectedFormats, setSelectedFormats] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [sortBy, setSortBy] = useState("newest");
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [allLoadedResources, setAllLoadedResources] = useState(initialResources || []);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE_DISPLAY);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetchLoading, setIsFetchLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreDB, setHasMoreDB] = useState(initialResources?.length === PAGE_SIZE_BATCH);
  const [serverOffset, setServerOffset] = useState(initialResources?.length || 0);
  const [previewResource, setPreviewResource] = useState(null);
  const [inPageSearch, setInPageSearch] = useState("");
  const deferredSearch = useDeferredValue(inPageSearch);
  // Remove folderTags state, will use SWR data directly

  const [historyStack, setHistoryStack] = useState([null]);
  const [historyPointer, setHistoryPointer] = useState(0);

  const loadMoreRef = useRef(null);
  const abortControllerRef = useRef(null);
  const lastRequestIdRef = useRef(0);
  const isFirstRun = useRef(true);
  const hasLoadedInitialStateRef = useRef(false);
  const historyStackRef = useRef([null]);
  const prevSlugRef = useRef(slug);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isPlugin = propIsPlugin || pathname?.startsWith("/plugins/") || searchParams.get("mode") === "plugin" || (typeof window !== 'undefined' && window.location.search.includes('mode=plugin'));
  const resSlug = searchParams.get("res");
  const { setFolderId } = useSidebar();

  const debouncedSearch = useDebounce(deferredSearch, 400);
  const debouncedTags = useDebounce(selectedTags, 300);
  const debouncedFormats = useDebounce(selectedFormats, 300);
  const debouncedFolderId = useDebounce(selectedFolderId, 100);
  const debouncedSortBy = useDebounce(sortBy, 100);

  const updateUrl = useCallback((updates) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
        params.delete(key);
      } else if (Array.isArray(value)) {
        params.set(key, value.join(","));
      } else {
        params.set(key, value);
      }

      // Cập nhật ref ngay lập tức để useEffect không ghi đè ngược lại
      if (key === "tags") lastSyncedTagsRef.current = Array.isArray(value) ? value.join(",") : (value || "");
      if (key === "format") lastSyncedFormatsRef.current = Array.isArray(value) ? value.join(",") : (value || "");
      if (key === "folder") lastSyncedFolderRef.current = value;
      if (key === "sort") lastSyncedSortRef.current = value;
    });
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleSelectFolder = useCallback((folder, isHistoryMove = false) => {
    const id = folder?.id || null;
    const name = folder ? (folder.path || folder.name) : null;

    // Auto-close ContextSearch when navigating via sidebar
    window.dispatchEvent(new CustomEvent("close-context-search"));

    startTransition(() => {
      setSelectedFolderId(id);
      setSelectedFolderName(name);
      setVisibleCount(PAGE_SIZE_DISPLAY);
      setFolderId(id);
      updateUrl({ folder: id });

      if (!isHistoryMove) {
        const newStack = historyStackRef.current.slice(0, historyPointer + 1);
        newStack.push(id);
        setHistoryStack(newStack);
        setHistoryPointer(newStack.length - 1);
        historyStackRef.current = newStack;
      }
    });
  }, [historyPointer, setFolderId, updateUrl]);

  useEffect(() => {
    const initialFolderId = searchParams.get("folder") || null;
    const initialFormats = searchParams.get("format")?.split(",") || [];
    const initialTags = searchParams.get("tags")?.split(",") || [];
    const initialSort = searchParams.get("sort") || "newest";

    if (initialFolderId) {
      setSelectedFolderId(initialFolderId);
      const result = findInTree(folders, initialFolderId);
      setSelectedFolderName(result?.current ? (result.current.path || result.current.name) : null);
      setFolderId(initialFolderId);
    }

    if (!hasLoadedInitialStateRef.current || prevSlugRef.current !== slug) {
      lastSyncedFolderRef.current = initialFolderId;
      lastSyncedFormatsRef.current = initialFormats.join(",");
      lastSyncedTagsRef.current = initialTags.join(",");
      lastSyncedSortRef.current = initialSort;

      const initialStack = initialFolderId ? [initialFolderId] : [null];
      setHistoryStack(initialStack);
      historyStackRef.current = initialStack;
      setHistoryPointer(0);
      hasLoadedInitialStateRef.current = true;
      prevSlugRef.current = slug;
    }
    
    if (initialFormats.length > 0) setSelectedFormats(initialFormats);
    if (initialTags.length > 0) setSelectedTags(initialTags);
    if (initialSort) setSortBy(initialSort);
    
    setIsInitialized(true);
  }, [slug, folders]);

  const lastSyncedTagsRef = useRef("");
  const lastSyncedFormatsRef = useRef("");
  const lastSyncedFolderRef = useRef(null);
  const lastSyncedSortRef = useRef("newest");

  useEffect(() => {
    if (!isInitialized || isPending) return;
    
    const folderId = searchParams.get("folder") || null;
    if (folderId !== lastSyncedFolderRef.current) {
      lastSyncedFolderRef.current = folderId;
      setSelectedFolderId(folderId);
      const result = findInTree(folders, folderId);
      setSelectedFolderName(result?.current ? (result.current.path || result.current.name) : null);
      setVisibleCount(PAGE_SIZE_DISPLAY);
    }
    
    const formatsStr = searchParams.get("format") || "";
    if (formatsStr !== lastSyncedFormatsRef.current) {
      lastSyncedFormatsRef.current = formatsStr;
      setSelectedFormats(formatsStr ? formatsStr.split(",") : []);
    }
    
    const tagsStr = searchParams.get("tags") || "";
    if (tagsStr !== lastSyncedTagsRef.current) {
      lastSyncedTagsRef.current = tagsStr;
      setSelectedTags(tagsStr ? tagsStr.split(",") : []);
    }
    
    const sort = searchParams.get("sort") || "newest";
    if (sort !== lastSyncedSortRef.current) {
      lastSyncedSortRef.current = sort;
      setSortBy(sort);
    }
  }, [searchParams, isInitialized, folders]);

  useEffect(() => {
    if (!isInitialized) return;
    
    if (resSlug) {
      const existing = allLoadedResources.find(r => r.slug === resSlug);
      if (existing) {
        if (previewResource?.slug !== resSlug) {
          setPreviewResource(existing);
        }
      } else {
        getResourceBySlug(resSlug).then(resource => {
          if (resource) {
            setAllLoadedResources(prev => {
              if (prev.find(r => r.id === resource.id)) return prev;
              return [resource, ...prev];
            });
            setPreviewResource(resource);
          }
        });
      }
    } else if (previewResource) {
      setPreviewResource(null);
    }
  }, [resSlug, allLoadedResources, isInitialized, previewResource]);

  useEffect(() => {
    const handleLocalSearch = (e) => setInPageSearch(e.detail || "");
    window.addEventListener("local-search", handleLocalSearch);
    return () => window.removeEventListener("local-search", handleLocalSearch);
  }, []);

  // When ContextSearch closes (click outside / ESC), navigate to root
  useEffect(() => {
    const handleNavigateToRoot = () => {
      setInPageSearch("");
      handleSelectFolder(null);
    };
    window.addEventListener("navigate-to-root", handleNavigateToRoot);
    return () => window.removeEventListener("navigate-to-root", handleNavigateToRoot);
  }, [handleSelectFolder]);

  useEffect(() => {
    if (!isInitialized) return;

    try {
      localStorage.setItem(`last_state_${slug}`, JSON.stringify({
        folderId: selectedFolderId,
        formats: selectedFormats,
        tags: selectedTags,
        sort: sortBy
      }));
    } catch (e) { console.warn("Save to localStorage failed:", e); }

    const requestId = ++lastRequestIdRef.current;
    if (abortControllerRef.current) abortControllerRef.current.abort();

    const refreshData = async () => {
      mediaManager.stopAll();
      const isFolderChangeOnly = debouncedFolderId !== lastSyncedFolderRef.current && !debouncedSearch && debouncedTags.length === 0 && debouncedFormats.length === 0;
      
      if (hasLoadedInitialStateRef.current && isFirstRun.current) {
        isFirstRun.current = false;
        const hasNoFilters = !debouncedSearch && debouncedTags.length === 0 && debouncedFormats.length === 0;
        if (initialResources?.length > 0 && hasNoFilters && debouncedFolderId === null) {
          if (requestId === lastRequestIdRef.current) {
            setAllLoadedResources(initialResources);
            setServerOffset(initialResources.length);
            setIsInitialLoading(false);
            setIsFetchLoading(false);
          }
          return;
        }
      }

      const isFreshLoad = (debouncedSearch || debouncedFormats.length > 0 || debouncedTags.length > 0) && !isFolderChangeOnly;
      
      // Chỉ hiện initial loading (skeleton toàn phần) khi load lần đầu hoặc thay đổi filter lớn.
      // Khi chỉ đổi folder, chúng ta giữ dữ liệu cũ và chỉ hiện fetch loading (mờ grid).
      if ((allLoadedResources.length === 0 || isFreshLoad) && !isFolderChangeOnly) {
        setIsInitialLoading(true);
      } else {
        setIsFetchLoading(true);
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const isFiltering = debouncedSearch || debouncedFormats.length > 0 || debouncedTags.length > 0 || resSlug;
      let folderIdToPass = debouncedFolderId;
      if (isFiltering && debouncedFolderId) {
        const node = findInTree(folders, debouncedFolderId)?.current;
        if (node) folderIdToPass = getDescendantIds(node);
      }

      try {
        const fresh = await getResources({
          categorySlug: slug,
          selectedTags: debouncedTags,
          selectedFormats: debouncedFormats,
          folderId: folderIdToPass,
          searchTerm: debouncedSearch,
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
      } catch (e) { if (e.name !== 'AbortError') console.error("Refresh fetch failed:", e); }
      finally {
        if (requestId === lastRequestIdRef.current) {
          setIsInitialLoading(false);
          setIsFetchLoading(false);
        }
      }
    };

    refreshData();
    const timeoutId = setTimeout(() => {
      if (requestId === lastRequestIdRef.current) {
        setIsInitialLoading(false);
        setIsFetchLoading(false);
      }
    }, 8000);

    return () => clearTimeout(timeoutId);
  }, [isInitialized, debouncedFolderId, debouncedFormats, debouncedTags, debouncedSortBy, debouncedSearch, slug]);

  const tagKey = (selectedFolderId && isInitialized) ? [`tags`, slug, selectedFolderId] : null;
  const { data: swrFolderTags, isValidating: isTagsValidating } = useSWR(tagKey, async ([, category, folder]) => {
    const node = findInTree(folders, folder)?.current;
    if (node) {
      const allSubFolderIds = getDescendantIds(node);
      const tags = await getCategoryTags(category, allSubFolderIds);
      return tags;
    }
    return [];
  }, { 
    revalidateOnFocus: false, 
    dedupingInterval: 60000,
    keepPreviousData: true // Giữ data cũ khi đang fetch key mới để tránh flicker
  });

  // Gỡ bỏ useEffect cũ cho folderTags

  useEffect(() => {
    setAllLoadedResources(initialResources);
    setServerOffset(initialResources.length);
    setHasMoreDB(initialResources.length === PAGE_SIZE_BATCH);
    setVisibleCount(PAGE_SIZE_DISPLAY);
  }, [slug]);

  const filteredResources = useMemo(() => {
    // Nếu đang ở cấp gốc (không chọn folder) và KHÔNG có bộ lọc nào kích hoạt,
    // chúng ta sẽ ẩn danh sách Resource để chỉ hiện các Folder con.
    // Trong plugin mode, luôn hiển thị resources ở root.
    const isAtRoot = !selectedFolderId;
    const hasSearch = inPageSearch && inPageSearch.trim().length > 0;
    const hasTags = selectedTags && selectedTags.length > 0;
    const hasFormats = selectedFormats && selectedFormats.length > 0;
    const isFiltering = hasSearch || hasTags || hasFormats || resSlug;

    // Ở trang gốc, chỉ hiện item khi có bộ lọc. Nếu không thì ẩn để hiện Folder.
    if (isAtRoot && !isFiltering) {
      return [];
    }

    let results = [...allLoadedResources];
    
    // Lọc cục bộ ngay lập tức
    if (hasSearch) {
      const s = inPageSearch.toLowerCase().trim();
      results = results.filter(r => 
        (r.name && r.name.toLowerCase().includes(s)) || 
        (r.tags && r.tags.some(t => t.toLowerCase().includes(s)))
      );
    }
    if (hasFormats) {
      results = results.filter(r => selectedFormats.includes(r.fileFormat));
    }
    if (hasTags) {
      const selectedSet = new Set(selectedTags.map(t => t.toLowerCase()));
      results = results.filter(r => 
        r.tags && r.tags.some(t => selectedSet.has(t.toLowerCase()))
      );
    }

    if (resSlug) {
      const target = results.find(r => r.slug === resSlug);
      if (target) return [target];
    }
    switch (sortBy) {
      case "popular": results.sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0)); break;
      case "name": results.sort((a, b) => (a.name || "").localeCompare(b.name || "")); break;
    }
    return results;
  }, [allLoadedResources, sortBy, resSlug, selectedFolderId, inPageSearch, selectedTags, selectedFormats]);

  // 1. Tối ưu: Chỉ tính toán bản đồ tần suất tag khi danh sách tài nguyên thay đổi
  const tagFrequencyMap = useMemo(() => {
    const map = new Map();
    allLoadedResources.forEach(r => {
      if (r.tags) {
        for (const t of r.tags) {
          const lowTag = t.toLowerCase();
          map.set(lowTag, (map.get(lowTag) || 0) + 1);
        }
      }
    });
    return map;
  }, [allLoadedResources]);

  // 2. Tối ưu: Tính toán danh sách tag hiển thị dựa trên trạng thái hiện tại
  const availableTags = useMemo(() => {
    const isFiltered = selectedTags.length > 0 || inPageSearch || selectedFormats.length > 0;
    const selectedTagsSet = new Set(selectedTags.map(t => t.toLowerCase()));
    
    let baseTagsNames;
    if (isFiltered) {
      // Trong chế độ lọc, hiển thị tất cả tag có trong tài nguyên đã load + tag đang chọn
      const names = new Set(selectedTagsSet);
      for (const name of tagFrequencyMap.keys()) {
        names.add(name);
      }
      baseTagsNames = Array.from(names);
    } else {
      // Trong chế độ duyệt:
      // 1. Ưu tiên dùng swrFolderTags nếu có (và không rỗng)
      // 2. Nếu đang ở root hoặc folder không có tags riêng, dùng categoryTags làm fallback
      const currentContextTags = (selectedFolderId && swrFolderTags && swrFolderTags.length > 0) ? swrFolderTags : categoryTags;
      baseTagsNames = currentContextTags.map(t => (typeof t === 'string' ? t : t.name).toLowerCase());
    }

    return baseTagsNames
      .map(name => ({
        name,
        count: tagFrequencyMap.get(name) || 0
      }))
      .filter(t => isFiltered ? (t.count > 0 || selectedTagsSet.has(t.name)) : true)
      .sort((a, b) => {
        // Ưu tiên các tag đang được chọn lên đầu
        const aSelected = selectedTagsSet.has(a.name);
        const bSelected = selectedTagsSet.has(b.name);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;

        if (isFiltered && a.count !== b.count) {
          return b.count - a.count;
        }
        
        return a.name.localeCompare(b.name);
      });
  }, [tagFrequencyMap, selectedFolderId, categoryTags, swrFolderTags, inPageSearch, selectedTags, selectedFormats]);

  const { currentSubfolders, parentFolder } = useMemo(() => {
    if (!selectedFolderId) return { currentSubfolders: folders, parentFolder: null };
    const result = findInTree(folders, selectedFolderId);
    return { currentSubfolders: result?.current?.children || [], parentFolder: result?.parent };
  }, [folders, selectedFolderId]);

  const currentFolder = useMemo(() => 
    selectedFolderId ? findInTree(folders, selectedFolderId)?.current : null,
    [folders, selectedFolderId]
  );

  const breadcrumbs = useMemo(() => {
    const crumbs = [];
    let curr = findInTree(folders, selectedFolderId);
    while (curr) {
      crumbs.unshift({ id: curr.current.id, name: curr.current.name });
      curr = curr.parent ? findInTree(folders, curr.parent.id) : null;
    }
    return crumbs;
  }, [folders, selectedFolderId]);

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

  const resetToRoot = () => handleSelectFolder(null);

  const handleLoadMore = useCallback(() => {
    if (isInitialLoading || isFetchLoading || isLoadingMore || !hasMoreDB) return;

    setIsLoadingMore(true);
    const isFiltering = debouncedSearch || debouncedFormats.length > 0 || debouncedTags.length > 0;
    let folderIdToPass = debouncedFolderId;
    if (isFiltering && debouncedFolderId) {
      const node = findInTree(folders, debouncedFolderId)?.current;
      if (node) folderIdToPass = getDescendantIds(node);
    }
    
    getResources({
      categorySlug: slug,
      selectedTags: debouncedTags,
      selectedFormats: debouncedFormats,
      folderId: folderIdToPass,
      searchTerm: debouncedSearch,
      offset: serverOffset,
      limit: PAGE_SIZE_BATCH,
    }).then(more => {
      if (more?.length > 0) {
        setAllLoadedResources(prev => [...prev, ...more]);
        setServerOffset(prev => prev + more.length);
        setHasMoreDB(more.length === PAGE_SIZE_BATCH);
      } else setHasMoreDB(false);
    }).finally(() => setIsLoadingMore(false));
  }, [isInitialLoading, isFetchLoading, isLoadingMore, hasMoreDB, serverOffset, debouncedSearch, debouncedFormats, debouncedTags, debouncedFolderId, slug, folders]);


  const { categories } = useSiteData();

  const getCategoryIcon = (slug) => {
    switch (slug) {
      case 'sound-effects': return <Volume2 size={14} />;
      case 'music': return <Music size={14} />;
      case 'luts': return <Camera size={14} />;
      case 'overlays': return <Layers size={14} />;
      case 'greenscreen': return <Video size={14} />;
      default: return <Folder size={14} />;
    }
  };

  if (isPlugin) {
    return (
      <div className={styles.pluginRoot}>
        {/* Top Category Nav */}
        <div className={styles.pluginCategoryNav}>
          {categories.map((cat) => (
            <button
              key={cat.slug}
              className={`${styles.pluginCatTab} ${slug === cat.slug ? styles.pluginCatTabActive : ""}`}
              onClick={() => {
                const params = new URLSearchParams(searchParams);
                params.set("category", cat.slug);
                params.delete("folder");
                params.delete("res");
                params.delete("tags");
                params.delete("format");
                
                // Reset local state
                startTransition(() => {
                  setSelectedFolderId(null);
                  setSelectedFolderName(null);
                  setFolderId(null);
                  router.push(`${pathname}?${params.toString()}`);
                });
              }}
            >
              {getCategoryIcon(cat.slug)}
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        <div className={styles.pluginLayout}>
          <Sidebar 
            folders={folders} 
            categorySlug={slug}
            categoryName={info.name}
            primaryColor={info.color}
            isPluginSidebar={true}
            onSelectFolder={handleSelectFolder}
            selectedFolderId={selectedFolderId}
          />

        <div className={styles.pluginContent}>
          <FilterSection
            info={info}
            selectedFormats={selectedFormats}
            setSelectedFormats={setSelectedFormats}
            availableTags={availableTags}
            selectedTags={selectedTags}
            setSelectedTags={setSelectedTags}
            sortBy={sortBy}
            setSortBy={setSortBy}
            inPageSearch={inPageSearch}
            setInPageSearch={setInPageSearch}
            resSlug={resSlug}
            breadcrumbs={breadcrumbs}
            handleSelectFolder={handleSelectFolder}
            updateUrl={updateUrl}
            router={router}
            pathname={pathname}
            folders={folders}
            findInTree={findInTree}
            isLoading={isInitialLoading || isFetchLoading || isTagsValidating}
            isPlugin={isPlugin}
          />

          <ResourceGrid 
            filteredResources={filteredResources}
            currentSubfolders={currentSubfolders}
            isInitialLoading={isInitialLoading}
            isFetchLoading={isFetchLoading}
            isPending={isPending}
            isLoadingMore={isLoadingMore}
            hasMoreDB={hasMoreDB}
            info={info}
            slug={slug}
            handleSelectFolder={handleSelectFolder}
            setPreviewResource={setPreviewResource}
            router={router}
            inPageSearch={deferredSearch}
            selectedFormats={selectedFormats}
            selectedTags={selectedTags}
            resSlug={resSlug}
            onLoadMore={handleLoadMore}
            isPlugin={isPlugin}
          />
        </div>

        {previewResource && (
          <PreviewOverlay 
            previewResource={previewResource}
            onClose={() => updateUrl({ res: null })} 
            showDownload={true} 
            showInsert={isPlugin}
            isPlugin={isPlugin}
          />
        )}
      </div>
    </div>
  );
}

  // Standard Web Layout
  return (
    <div className={styles.main}>
      <NavigationHeader 
        selectedFolderId={selectedFolderId}
        resetToRoot={resetToRoot}
        goBack={goBack}
        goForward={goForward}
        historyPointer={historyPointer}
        historyStack={historyStack}
        currentFolder={currentFolder}
        info={info}
      />

      <FilterSection
        info={info}
        selectedFormats={selectedFormats}
        setSelectedFormats={setSelectedFormats}
        availableTags={availableTags}
        selectedTags={selectedTags}
        setSelectedTags={setSelectedTags}
        sortBy={sortBy}
        setSortBy={setSortBy}
        inPageSearch={inPageSearch}
        setInPageSearch={setInPageSearch}
        resSlug={resSlug}
        breadcrumbs={breadcrumbs}
        handleSelectFolder={handleSelectFolder}
        updateUrl={updateUrl}
        router={router}
        pathname={pathname}
        folders={folders}
        findInTree={findInTree}
        isLoading={isInitialLoading || isFetchLoading || isTagsValidating}
        isPlugin={isPlugin}
      />

      <ResourceGrid 
        filteredResources={filteredResources}
        currentSubfolders={currentSubfolders}
        isInitialLoading={isInitialLoading}
        isFetchLoading={isFetchLoading}
        isPending={isPending}
        isLoadingMore={isLoadingMore}
        hasMoreDB={hasMoreDB}
        info={info}
        slug={slug}
        handleSelectFolder={handleSelectFolder}
        setPreviewResource={setPreviewResource}
        router={router}
        inPageSearch={deferredSearch}
        selectedFormats={selectedFormats}
        selectedTags={selectedTags}
        resSlug={resSlug}
        onLoadMore={handleLoadMore}
        isPlugin={isPlugin}
      />

      {previewResource && (
        <PreviewOverlay 
          previewResource={previewResource}
          onClose={() => updateUrl({ res: null })} 
          showDownload={true} 
          showInsert={false}
          isPlugin={false}
        />
      )}
    </div>
  );
}

export default function ClientPage(props) {
  return (
    <Suspense fallback={<div style={{ padding: '20px', color: '#666' }}>Loading...</div>}>
      <ClientPageContent {...props} />
    </Suspense>
  );
}
