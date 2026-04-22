"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';

import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Plus, Search, Trash2, Edit2, MoreVertical, LayoutGrid, List as ListIcon, FolderPlus, Loader2, Play, Pause, Eye } from "lucide-react";
import { revalidateResourceData, revalidateCategoryData, revalidateFolderData, revalidateTagData } from "@/app/lib/actions";
import { 
  addFolder, 
  updateResource, 
  updateFolder, 
  deleteFolder, 
  deleteResource, 
  syncTagsCount,
  bulkUpdateResources,
  bulkDeleteResources
} from "@/app/lib/api";
import styles from "./page.module.css";
import { mediaManager } from "@/app/lib/mediaManager";
import PreviewOverlay from "@/app/components/ui/PreviewOverlay";
import { isAudioFormat, isVideoFormat, isImageFormat, isFontFormat } from "@/app/lib/mediaUtils";
import { useDebounce } from "@/app/hooks/useDebounce";
import { useInfiniteScroll } from "@/app/hooks/useInfiniteScroll";
import TableSkeleton from "@/app/components/ui/TableSkeleton";

// New Components & Hooks
import { useAdminUpload } from "./hooks/useAdminUpload";
import { getFilesFromDataTransfer } from "./utils/dropUtils";
import AdminDropOverlay from "./components/AdminDropOverlay";
import UploadDrawer from "./components/UploadDrawer";
import FolderTree from "./components/FolderTree";
import BulkToolbar from "./components/BulkToolbar";
import BulkEditModal from "./components/BulkEditModal";
import MoveSelectionModal from "./components/MoveSelectionModal";

const fetcher = url => fetch(url).then(r => r.json());

export default function AdminResources() {

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('q') || "";
    }
    return "";
  });
  
  const debouncedSearch = useDebounce(searchQuery, 500);
  
  const [selectedFolderId, setSelectedFolderId] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('folder') || null;
    }
    return null;
  });

  // SWR Keys & Fetching for Resources
  const getKey = (pageIndex, previousPageData) => {
    if (previousPageData && !previousPageData.hasMore) return null;
    const params = new URLSearchParams({
      page: pageIndex.toString(),
      limit: "25",
      q: debouncedSearch,
      folder: selectedFolderId || ""
    });
    return `/api/admin/resources?${params.toString()}`;
  };

  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite(getKey, fetcher, {
    persistSize: true
  });

  // Metadata Fetching via SWR
  const { data: metadata, mutate: mutateMeta } = useSWR('/api/admin/metadata', fetcher);
  const folders = metadata?.folders || [];
  const categories = metadata?.categories || [];
  const tags = metadata?.tags || [];

  const resources = data ? data.map(page => page.data).flat() : [];
  const loading = !data && !error;
  const loadingMore = size > 0 && data && typeof data[size - 1] === "undefined";
  const hasMore = data ? data[data.length - 1]?.hasMore : true;
  const totalCount = data ? data[0]?.count : 0;
  
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('admin_view_mode') || 'grid';
    }
    return 'grid';
  });
  
  // Renaming State
  const [renamingResourceId, setRenamingResourceId] = useState(null);
  const [renamingName, setRenamingName] = useState("");
  
  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  
  // Audio & Preview State
  const [playingId, setPlayingId] = useState(null);
  const [previewResource, setPreviewResource] = useState(null);
  const audioRef = useRef(null);
  
  // Bulk Actions State
  const [selectedIds, setSelectedIds] = useState([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Load persistence: viewMode
  useEffect(() => {
    const saved = localStorage.getItem('admin_view_mode');
    if (saved) setViewMode(saved);
  }, []);

  // Sync state to URL & localStorage
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (searchQuery) {
      params.set('q', searchQuery);
    } else {
      params.delete('q');
    }
    
    if (selectedFolderId) {
      params.set('folder', selectedFolderId);
    } else {
      params.delete('folder');
    }
    
    const newPath = `${pathname}?${params.toString()}`;
    // Use replace to avoid polluting history with every keystroke in search
    // But maybe for folder navigation we want push. 
    // Let's use push for folder changes and replace for search query typing.
    const isSearchChange = searchParams.get('q') !== (searchQuery || null);
    
    if (isSearchChange) {
      router.replace(newPath, { scroll: false });
    } else if (searchParams.get('folder') !== (selectedFolderId || null)) {
      router.push(newPath, { scroll: false });
    }
  }, [selectedFolderId, searchQuery, pathname, router, searchParams]);

  // Sync viewMode to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_view_mode', viewMode);
    }
  }, [viewMode]);
  
  const { 
    stagingFiles, 
    isUploading, 
    uploadProgress, 
    addFiles, 
    updateFileMeta, 
    updateBulkMeta,
    removeFile, 
    clearAll,
    uploadAll 
  } = useAdminUpload();

  const handleUploadAll = async () => {
    await uploadAll();
    // Invalidate everything to show new items and update counts
    await Promise.all([mutate(), mutateMeta()]);
    router.refresh();
  };

  // Infinite Scroll Trigger
  const loaderRef = useInfiniteScroll(hasMore, loading || loadingMore || isValidating, () => {
    if (hasMore && !isValidating) {
      setSize(size + 1);
    }
  });


  // Handle Global Drag and Drop (Files from OS)
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      // Check if it's files (OS) or internal move
      if (e.dataTransfer.items[0].kind === 'file') {
        setIsDragging(true);
      }
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setIsDragging(false);
    dragCounter.current = 0;
    
    if (e.dataTransfer.files.length > 0) {
      const files = await getFilesFromDataTransfer(e.dataTransfer);
      // Pre-fill folder if we are currently inside one
      const targetFolderId = selectedFolderId?.startsWith('cat-') ? null : selectedFolderId;
      addFiles(files, targetFolderId);
    }
  }, [addFiles, selectedFolderId]);

  // Handle Internal Resource Move (Grid to Sidebar)
  const handleResourceDragStart = (e, resource) => {
    // If dragging a selected item, we move all selected items
    const ids = selectedIds.includes(resource.id) ? selectedIds : [resource.id];
    const data = JSON.stringify(ids);
    
    e.dataTransfer.setData("resourceIds", data);
    e.dataTransfer.setData("text/plain", `resources:${data}`);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDropResource = async (idOrIds, targetFolderId, targetCatIdFromUI) => {
    try {
      const idsToMove = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
      
      // Resolve target category ID
      let targetCatId = targetCatIdFromUI;
      if (!targetCatId && targetFolderId) {
        const targetFolder = folders.find(f => f.id === targetFolderId);
        targetCatId = targetFolder?.categorySlug || targetFolder?.category_id;
      }
      
      const targetCategoryNode = categories.find(c => c.id === targetCatId || c.slug === targetCatId);

      // 1. Update Supabase in bulk
      const updates = idsToMove.map(id => ({
        id,
        folder_id: targetFolderId,
        category_id: targetCatId || undefined, 
        updated_at: new Date().toISOString()
      }));
      await bulkUpdateResources(updates);
      
      // 2. Mutate SWR
      await Promise.all([mutate(), mutateMeta()]);
      router.refresh();
      
      // 3. Clear selection
      setSelectedIds([]);
      
      // 4. Revalidate frontend (both resources and category counts)
      await Promise.all([
        revalidateResourceData(),
        revalidateCategoryData(),
        revalidateFolderData(),
        revalidateTagData()
      ]);
    } catch (e) {
      console.error("Move failed:", e);
      alert("Không thể di chuyển tài nguyên.");
    }
  };

  const filtered = resources; // Already filtered server-side

  const handleAddFolder = async (parentId, categorySlug) => {
    const name = prompt("Nhập tên thư mục mới:");
    if (!name) return;
    
    try {
      const newFolder = {
        name,
        parentId,
        categorySlug,
        order: folders.length,
      };
      await addFolder(newFolder);
      
      // Update sidebar
      await mutateMeta();
      
      // Refresh frontend cache
      await Promise.all([
        revalidateResourceData(),
        revalidateFolderData()
      ]);
    } catch (e) {
      alert("Lỗi khi thêm thư mục: " + e.message);
    }
  };

  const handleRenameFolder = async (folderId, newName) => {
    try {
      await updateFolder(folderId, { name: newName });
      await mutateMeta();
      await Promise.all([
        revalidateResourceData(),
        revalidateFolderData()
      ]);
    } catch (e) {
      console.error("Rename failed:", e);
      alert("Đổi tên thư mục thất bại.");
    }
  };

  const handleMoveFolder = async (folderId, targetParentId, targetCategorySlug) => {
    try {
      // Validate: cannot move into itself
      if (folderId === targetParentId) return;

      // Update Database
      await updateFolder(folderId, { 
        parentId: targetParentId, 
        categorySlug: targetCategorySlug 
      });

      // Update SWR
      await mutateMeta();
      router.refresh();

      // Revalidate frontend
      await Promise.all([
        revalidateResourceData(),
        revalidateFolderData()
      ]);
    } catch (e) {
      console.error("Move folder failed:", e);
      alert("Không thể di chuyển thư mục.");
    }
  };

  const handleDeleteFolder = async (folder) => {
    // 1. Double check with user
    const hasChildren = folders.some(f => f.parentId === folder.id);
    const msg = hasChildren 
      ? `Xóa thư mục "${folder.name}"? Các thư mục con bên trong sẽ được chuyển ra ngoài.` 
      : `Bạn có chắc chắn muốn xóa thư mục "${folder.name}"?`;
      
    if (!confirm(msg)) return;
    
    try {
      // 2. Orphan sub-folders (set parentId to null)
      const subFolders = folders.filter(f => f.parentId === folder.id);
      await Promise.all(subFolders.map(sf => updateFolder(sf.id, { parentId: null })));
      
      // 3. Orphan resources (set folderId to null)
      const folderResources = resources.filter(r => r.folderId === folder.id);
      await bulkUpdateResources(folderResources.map(r => ({ id: r.id, folder_id: null })));

      // 4. Delete the folder itself
      await deleteFolder(folder.id);
      
      // 5. Update SWR
      await Promise.all([mutate(), mutateMeta()]);
      router.refresh();
      
      // 6. If we were viewing this folder, switch to category root
      if (selectedFolderId === folder.id) {
        setSelectedFolderId(`cat-${folder.categorySlug}`);
      }
      
      // 7. Refresh frontend
      await Promise.all([
        revalidateResourceData(),
        revalidateFolderData()
      ]);
    } catch (e) {
      alert("Xóa thư mục thất bại: " + e.message);
    }
  };


  const getFolderPath = useCallback((folderId, categorySlug) => {
    const path = [];
    const category = categories.find(c => c.slug === categorySlug);
    if (category) {
      path.push({ id: `cat-${categorySlug}`, name: category.name });
    }

    if (!folderId) return path;

    const folderChain = [];
    let currentId = folderId;
    while (currentId) {
      const folder = folders.find(f => f.id === currentId);
      if (!folder) break;
      folderChain.unshift({ id: folder.id, name: folder.name });
      currentId = folder.parentId;
    }
    
    return [...path, ...folderChain];
  }, [folders, categories]);

  const currentPath = useMemo(() => {
    if (!selectedFolderId) return [{ id: null, name: 'Tất cả tài nguyên' }];
    
    if (selectedFolderId.startsWith('cat-')) {
      const slug = selectedFolderId.replace('cat-', '');
      const cat = categories.find(c => c.slug === slug);
      return [{ id: selectedFolderId, name: cat?.name || slug }];
    }
    
    const folder = folders.find(f => f.id === selectedFolderId);
    if (!folder) return [{ id: null, name: 'Tất cả tài nguyên' }];
    
    return getFolderPath(selectedFolderId, folder.categorySlug);
  }, [selectedFolderId, categories, folders, getFolderPath]);

  const handleRenameResource = async (id, originalName) => {
    const newName = renamingName.trim();
    if (!newName || newName === originalName) {
      setRenamingResourceId(null);
      return;
    }

    try {
      await updateResource(id, { name: newName });
      await Promise.all([mutate(), mutateMeta()]);
      router.refresh();
      setRenamingResourceId(null);
      await Promise.all([
        revalidateResourceData(),
        revalidateTagData()
      ]);

    } catch (e) {
      console.error("Rename failed:", e);
      alert("Đổi tên thất bại.");
      setRenamingResourceId(null);
    }
  };

  async function handleDelete(id, displayName) {
    if (!confirm(`Xóa "${displayName}"? Thao tác này không thể hoàn tác.`)) return;
    try {
      await deleteResource(id);
      await Promise.all([mutate(), mutateMeta()]);
      router.refresh();
      setSelectedIds(prev => prev.filter(sid => sid !== id));
      await Promise.all([
        revalidateResourceData(),
        revalidateTagData()
      ]);

    } catch (e) {
      console.error("Delete failed:", e);
      alert("Xóa thất bại: " + e.message);
    }
  }

  // Bulk Actions
  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(r => r.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Xóa ${selectedIds.length} tài nguyên đã chọn? Thao tác này không thể hoàn tác.`)) return;

    try {
      await bulkDeleteResources(selectedIds);

      await Promise.all([mutate(), mutateMeta()]);
      router.refresh();
      setSelectedIds([]);
      await Promise.all([
        revalidateResourceData(),
        revalidateTagData()
      ]);

    } catch (e) {
      console.error("Bulk delete failed:", e);
      alert("Xóa hàng loạt thất bại.");
    }
  };

  const handleBulkEditSave = async (updatedItems) => {
    try {
      const addedTotal = [];
      const removedTotal = [];

      updatedItems.forEach(item => {
        const oldItem = resources.find(r => r.id === item.id);
        if (oldItem) {
          const oldTags = oldItem.tags || [];
          const newTags = item.tags || [];
          
          addedTotal.push(...newTags.filter(t => !oldTags.includes(t)));
          removedTotal.push(...oldTags.filter(t => !newTags.includes(t)));
        }
      });

      await bulkUpdateResources(updatedItems.map(item => ({
        id: item.id,
        name: item.name,
        tags: item.tags,
        category_id: item.categoryId || null,
        folder_id: item.folderId || null,
        updated_at: new Date().toISOString()
      })));

      // Đồng bộ tag count
      if (addedTotal.length > 0 || removedTotal.length > 0) {
        await syncTagsCount(addedTotal, removedTotal);
      }

      // Update SWR
      await Promise.all([mutate(), mutateMeta()]);
      router.refresh();
      
      setIsBulkEditOpen(false);
      setSelectedIds([]);
      await Promise.all([
        revalidateResourceData(),
        revalidateTagData()
      ]);

    } catch (e) {
      console.error("Bulk edit failed:", e);
      alert("Lưu thay đổi hàng loạt thất bại.");
    }
  };

  const handlePlay = (e, resource) => {
    e.stopPropagation();
    e.preventDefault();

    if (!isAudioFormat(resource)) {
      setPreviewResource(resource);
      return;
    }

    if (playingId === resource.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        setPlayingId(null);
        mediaManager.stop(audioRef.current);
      }
      return;
    }

    // Stop current if any
    if (audioRef.current) {
      audioRef.current.pause();
      mediaManager.stop(audioRef.current);
    }

    const audio = new Audio(resource.downloadUrl || resource.fileUrl);
    audioRef.current = audio;
    
    mediaManager.play(audio, () => {
      setPlayingId(null);
    });

    audio.play().then(() => {
      setPlayingId(resource.id);
    }).catch(err => {
      if (err.name === 'AbortError') return;
      console.error("Playback failed:", err);
      setPlayingId(null);
    });

    audio.onended = () => {
      setPlayingId(null);
      mediaManager.stop(audio);
    };
  };

  const isAudio = (res) => isAudioFormat(res);
  
  const isVisual = (res) => isVideoFormat(res) || isImageFormat(res) || isFontFormat(res);

  return (
    <>
      <AdminDropOverlay isDragging={isDragging} />
      <UploadDrawer 
        files={stagingFiles}
        folders={folders}
        categories={categories}
        isOpen={stagingFiles.length > 0}
        onClose={clearAll} 
        onUpdate={updateFileMeta}
        onUpdateBulk={updateBulkMeta}
        onRemove={removeFile}
        onUpload={handleUploadAll}
        isUploading={isUploading}
        progress={uploadProgress}
      />
      
      <div 
        className={styles.adminContainer}
        onDragEnter={handleDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
      
      <aside className={styles.sidebar}>
        <FolderTree 
          folders={folders} 
          categories={categories}
          selectedId={selectedFolderId}
          onSelect={setSelectedFolderId}
          onAddFolder={handleAddFolder}
          onRenameFolder={handleRenameFolder}
          onMoveFolder={handleMoveFolder}
          onDropResource={handleDropResource}
          onDeleteFolder={handleDeleteFolder}
        />
      </aside>

      <main className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <div className={styles.topActions}>
            <div className={styles.titleSection}>
              <h1>Quản lý tài nguyên</h1>
              <span className={styles.subtitle}>
                {loading ? "Đang tải..." : `${totalCount} tài nguyên`}
              </span>
            </div>
            <div className={styles.headerTools}>
              <button 
                className={styles.addBtn}
                onClick={() => document.getElementById('manual-upload').click()}
              >
                <Plus size={18} />
                Tải lên nhanh
              </button>
              <input 
                type="file" 
                id="manual-upload" 
                multiple 
                hidden 
                onChange={async (e) => {
                  if (e.target.files.length > 0) {
                    const files = Array.from(e.target.files);
                    const targetFolderId = selectedFolderId?.startsWith('cat-') ? null : selectedFolderId;
                    addFiles(files, targetFolderId);
                  }
                }}
              />
            </div>
          </div>

          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <Search size={18} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Tìm nhanh theo tên, tags hoặc định dạng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            <div className={styles.viewToggle}>
              <button 
                className={`${styles.bulkToggleBtn} ${isSelectionMode ? styles.active : ""}`}
                onClick={() => {
                  if (isSelectionMode) {
                    setSelectedIds([]);
                  }
                  setIsSelectionMode(!isSelectionMode);
                }}
              >
                {isSelectionMode ? "Exit Bulk Edit" : "Bulk Edit"}
              </button>

              {isSelectionMode && (
                <button 
                  className={`${styles.selectBtn} ${selectedIds.length === filtered.length && filtered.length > 0 ? styles.active : ""}`}
                  onClick={selectAll}
                  title="Chọn tất cả"
                >
                  {selectedIds.length === filtered.length && filtered.length > 0 ? "Bỏ chọn hết" : "Chọn tất cả"}
                </button>
              )}
              <button 
                className={`${styles.toggleBtn} ${viewMode === 'list' ? styles.active : ''}`}
                onClick={() => setViewMode('list')}
              >
                <ListIcon size={18} />
              </button>
              <button 
                className={`${styles.toggleBtn} ${viewMode === 'grid' ? styles.active : ''}`}
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid size={18} />
              </button>
            </div>
          </div>
          
          <div className={styles.breadcrumbArea}>
            {currentPath.map((item, i) => (
              <span key={item.id || 'root'} className={styles.globalBreadcrumbItem}>
                <button 
                  className={styles.breadcrumbLink}
                  onClick={() => setSelectedFolderId(item.id)}
                >
                  {item.name}
                </button>
                {i < currentPath.length - 1 && <span className={styles.breadcrumbDivider}>/</span>}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.scrollArea}>
          <div className={`${styles.resourceGrid} ${viewMode === 'list' ? styles.listMode : ''} ${isSelectionMode ? styles.selectionMode : ''}`}>
            {viewMode === 'list' && filtered.length > 0 && !loading && (
              <div className={styles.listHeader}>
                {isSelectionMode && (
                  <div className={styles.colCheckbox}>
                    <input 
                      type="checkbox" 
                      checked={selectedIds.length === filtered.length && filtered.length > 0} 
                      onChange={selectAll}
                    />
                  </div>
                )}
                <div className={styles.colName}>Tên tài nguyên</div>
                <div className={styles.colDate}>Ngày tạo</div>
                <div className={styles.colSize}>Dung lượng</div>
                <div className={styles.colActions}>Thao tác</div>
              </div>
            )}
            {loading ? (
              <div className={styles.loadingBox}>
                <TableSkeleton rows={8} cols={viewMode === 'list' ? 5 : 4} />
              </div>
            ) : filtered.length > 0 ? (
              filtered.map((r) => (
                <div 
                  key={r.id} 
                  className={`${styles.card} ${viewMode === 'list' ? styles.listRow : ''} ${selectedIds.includes(r.id) ? styles.selectedCard : ''}`}
                  draggable="true"
                  onDragStart={(e) => handleResourceDragStart(e, r)}
                  onClick={() => isSelectionMode && viewMode === 'list' ? toggleSelect(r.id) : null}
                >

                  {viewMode === 'grid' ? (
                    <>
                      {isSelectionMode && (
                        <div className={styles.cardCheckbox}>
                          <input 
                            type="checkbox" 
                            checked={selectedIds.includes(r.id)} 
                            onChange={() => toggleSelect(r.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      )}
                      <div className={styles.cardPreview} onClick={() => isSelectionMode ? toggleSelect(r.id) : null}>
                        {(r.thumbnailUrl || r.previewUrl) ? (
                          <img 
                            src={r.thumbnailUrl || r.previewUrl} 
                            alt={r.name} 
                            className={styles.previewImage}
                            loading="lazy"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : isVideoFormat(r) ? (
                          <video 
                            src={`${r.downloadUrl || r.fileUrl}#t=0.1`} 
                            className={styles.previewImage}
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : isImageFormat(r) ? (
                          <img 
                            src={r.downloadUrl || r.fileUrl} 
                            alt={r.name} 
                            className={styles.previewImage}
                            loading="lazy"
                          />
                        ) : null}
                        <div className={styles.cardIcon} style={{ display: (r.thumbnailUrl || r.previewUrl || isVideoFormat(r) || isImageFormat(r)) ? 'none' : 'flex' }}>
                          <LayoutGrid size={48} strokeWidth={1} />
                        </div>
                        <div className={styles.cardOverlay}>
                          <button
                            className={`${styles.actionBtn} ${playingId === r.id ? styles.active : ''}`}
                            onClick={(e) => handlePlay(e, r)}
                            title={isAudioFormat(r) ? "Nghe thử" : "Xem trước"}
                          >
                            {playingId === r.id ? <Pause size={18} /> : <Play size={18} />}
                          </button>
                          <Link href={`/admin/resources/${r.id}`} className={`${styles.actionBtn} ${styles.edit}`} title="Chỉnh sửa">
                            <Edit2 size={18} />
                          </Link>
                          <button
                            className={`${styles.actionBtn} ${styles.delete}`}
                            title="Xóa"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleDelete(r.id, r.name || r.fileName || "Tài nguyên");
                            }}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      <div className={styles.cardInfo}>
                        {renamingResourceId === r.id ? (
                          <input
                            className={styles.renameInput}
                            value={renamingName}
                            onChange={(e) => setRenamingName(e.target.value)}
                            onBlur={() => handleRenameResource(r.id, r.name)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameResource(r.id, r.name);
                              if (e.key === 'Escape') setRenamingResourceId(null);
                            }}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <h3 
                            className={styles.cardTitle}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setRenamingResourceId(r.id);
                              setRenamingName(r.name || r.fileName || "");
                            }}
                          >
                            {r.name || r.fileName || "Untitled"}
                          </h3>
                        )}
                        <div className={styles.cardMeta}>
                          <span className={styles.formatBadge}>{r.fileFormat}</span>
                          <span className={styles.categoryName}>{r.category?.name || "Uncategorized"}</span>
                        </div>
                        
                        <div className={styles.cardDetails}>
                          <span className={styles.cardDetailItem}>
                            {r.fileSize ? (r.fileSize / 1024 / 1024).toFixed(2) + ' MB' : '---'}
                          </span>
                          <span className={styles.cardDetailDivider}>•</span>
                          <span className={styles.cardDetailItem}>
                            {r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : '---'}
                          </span>
                        </div>

                        {r.tags && r.tags.length > 0 && (
                          <div className={styles.cardTags}>
                            {r.tags.slice(0, 3).map((tag, i) => (
                              <span key={i} className={styles.tagBadge}>{tag}</span>
                            ))}
                            {r.tags.length > 3 && <span className={styles.tagMore}>+{r.tags.length - 3}</span>}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {isSelectionMode && (
                        <div className={styles.listColCheckbox} onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={selectedIds.includes(r.id)} 
                            onChange={() => toggleSelect(r.id)}
                          />
                        </div>
                      )}
                      <div className={styles.listColName}>
                        <div className={styles.listIconSmall}>
                          {(r.thumbnailUrl || r.previewUrl) ? (
                            <img 
                              src={r.thumbnailUrl || r.previewUrl} 
                              alt={r.name} 
                              className={styles.listPreviewImg}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className={styles.listIconFallback} style={{ display: (r.thumbnailUrl || r.previewUrl) ? 'none' : 'flex' }}>
                            <LayoutGrid size={20} strokeWidth={1.5} />
                          </div>
                        </div>
                        <div className={styles.listNameInfo}>
                          {renamingResourceId === r.id ? (
                            <input
                              className={styles.renameInput}
                              value={renamingName}
                              onChange={(e) => setRenamingName(e.target.value)}
                              onBlur={() => handleRenameResource(r.id, r.name)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameResource(r.id, r.name);
                                if (e.key === 'Escape') setRenamingResourceId(null);
                              }}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span 
                              className={styles.listTitle}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setRenamingResourceId(r.id);
                                setRenamingName(r.name || r.fileName || "");
                              }}
                            >
                              {r.name || r.fileName || "Untitled"}
                            </span>
                          )}
                          <div className={styles.listMetaRow}>
                            <span className={styles.listCategory}>{r.fileFormat}</span>
                            {r.tags && r.tags.length > 0 && (
                              <div className={styles.listTags}>
                                {r.tags.slice(0, 2).map((tag, i) => (
                                  <span key={i} className={styles.listTagBadge}>{tag}</span>
                                ))}
                                {r.tags.length > 2 && <span className={styles.listTagMore}>...</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={styles.listColDate} suppressHydrationWarning>
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : '---'}
                      </div>
                      <div className={styles.listColSize}>
                        {r.fileSize ? (r.fileSize / 1024 / 1024).toFixed(2) + ' MB' : '---'}
                      </div>
                      <div className={styles.listColActions}>
                        <button
                          className={`${styles.inlineActionBtn} ${playingId === r.id ? styles.active : ''}`}
                          onClick={(e) => handlePlay(e, r)}
                          title={isAudioFormat(r) ? "Nghe thử" : "Xem trước"}
                        >
                          {playingId === r.id ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                        <Link href={`/admin/resources/${r.id}`} className={styles.inlineActionBtn} title="Chỉnh sửa">
                          <Edit2 size={16} />
                        </Link>
                        <button 
                          className={`${styles.inlineActionBtn} ${styles.delete}`}
                          title="Xóa"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleDelete(r.id, r.name || r.fileName || "Tài nguyên");
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            ) : (
              <div className={styles.emptyBox}>
                <p>Thư mục này còn trống. Kéo thả file vào để bắt đầu!</p>
              </div>
            )}
          </div>

          {/* Infinite Scroll Loader Target */}
          <div ref={loaderRef} className={styles.infiniteLoader}>
            {loadingMore && (
               <div className={styles.moreSpinner}>
                 <Loader2 size={24} className={styles.spin} />
                 <span>Đang tải thêm...</span>
               </div>
            )}
            {!hasMore && filtered.length > 0 && (
              <p className={styles.endMessage}>Đã hiển thị tất cả tài nguyên</p>
            )}
          </div>
        </div>
      </main>
      </div>

      <PreviewOverlay 
        resource={previewResource} 
        onClose={() => setPreviewResource(null)} 
      />

      <BulkToolbar 
        selectedCount={selectedIds.length}
        onClear={() => setSelectedIds([])}
        onDelete={handleBulkDelete}
        onEdit={() => setIsBulkEditOpen(true)}
        onMove={() => setIsMoveModalOpen(true)}
      />

      <BulkEditModal 
        isOpen={isBulkEditOpen}
        onClose={() => setIsBulkEditOpen(false)}
        selectedResources={resources.filter(r => selectedIds.includes(r.id))}
        allResources={resources}
        folders={folders}
        categories={categories}
        onSave={handleBulkEditSave}
      />

      <MoveSelectionModal 
        isOpen={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        selectedCount={selectedIds.length}
        folders={folders}
        onConfirm={(targetFolderId) => {
          handleDropResource(selectedIds, targetFolderId);
          setIsMoveModalOpen(false);
        }}
      />
    </>
  );
}

