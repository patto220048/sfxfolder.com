"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { Plus, Search, Trash2, Edit2, MoreVertical, LayoutGrid, List as ListIcon, FolderPlus, Loader2 } from "lucide-react";
import { collection, getDocs, doc, deleteDoc, query, where, orderBy } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { revalidateResourceData } from "@/app/lib/actions";
import { getAllAdminFolders, getCategories, addFolder, updateResource, updateFolder, deleteFolder } from "@/app/lib/firestore";
import styles from "./page.module.css";

// New Components & Hooks
import { useAdminUpload } from "./hooks/useAdminUpload";
import { getFilesFromDataTransfer } from "./utils/dropUtils";
import AdminDropOverlay from "./components/AdminDropOverlay";
import UploadDrawer from "./components/UploadDrawer";
import FolderTree from "./components/FolderTree";

export default function AdminResources() {
  const [searchQuery, setSearchQuery] = useState("");
  const [resources, setResources] = useState([]);
  const [folders, setFolders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Navigation State
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  
  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  
  const { 
    stagingFiles, 
    isUploading, 
    uploadProgress, 
    addFiles, 
    updateFileMeta, 
    removeFile, 
    clearAll,
    uploadAll 
  } = useAdminUpload();

  useEffect(() => {
    async function loadInitial() {
      try {
        const [resSnap, folderData, catData] = await Promise.all([
          getDocs(query(collection(db, "resources"), orderBy("createdAt", "desc"))),
          getAllAdminFolders(),
          getCategories()
        ]);
        
        setResources(resSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setFolders(folderData);
        setCategories(catData);
      } catch (e) {
        console.error("Failed to load initial data:", e.message);
      }
      setLoading(false);
    }
    loadInitial();
  }, [stagingFiles.length]); // Reload when uploads finish

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
    e.dataTransfer.setData("resourceId", resource.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDropResource = async (resourceId, targetFolderId) => {
    try {
      // 1. Update Firestore
      await updateResource(resourceId, { folderId: targetFolderId });
      
      // 2. Update local state for "Super Speed" feedback
      setResources(prev => prev.map(r => 
        r.id === resourceId ? { ...r, folderId: targetFolderId } : r
      ));
      
      // 3. Revalidate frontend
      await revalidateResourceData();
    } catch (e) {
      console.error("Move failed:", e);
      alert("Không thể di chuyển tài nguyên.");
    }
  };

  const filtered = useMemo(() => {
    let result = resources;
    
    // Filter by Tree Selection
    if (selectedFolderId) {
      if (selectedFolderId.startsWith('cat-')) {
        const catSlug = selectedFolderId.replace('cat-', '');
        result = result.filter(r => r.category === catSlug);
      } else {
        result = result.filter(r => r.folderId === selectedFolderId);
      }
    }

    // Filter by Search
    if (!searchQuery.trim()) return result;
    const term = searchQuery.toLowerCase();
    return result.filter(
      (r) =>
        r.name?.toLowerCase().includes(term) ||
        r.category?.toLowerCase().includes(term) ||
        r.tags?.some((t) => t.toLowerCase().includes(term))
    );
  }, [resources, searchQuery, selectedFolderId]);

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
      const docRef = await addFolder(newFolder);
      setFolders(prev => [...prev, { id: docRef.id, ...newFolder }]);
      
      // Refresh frontend cache
      await revalidateResourceData();
    } catch (e) {
      alert("Lỗi khi thêm thư mục: " + e.message);
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
      await Promise.all(folderResources.map(r => updateResource(r.id, { folderId: null })));

      // 4. Delete the folder itself
      await deleteDoc(doc(db, "folders", folder.id));
      
      // 5. Update local state
      setFolders(prev => {
        const filtered = prev.filter(f => f.id !== folder.id);
        return filtered.map(f => f.parentId === folder.id ? { ...f, parentId: null } : f);
      });
      
      setResources(prev => prev.map(r => r.folderId === folder.id ? { ...r, folderId: null } : r));

      
      // 5. If we were viewing this folder, switch to category root
      if (selectedFolderId === folder.id) {
        setSelectedFolderId(`cat-${folder.categorySlug}`);
      }
      
      // 6. Refresh frontend
      await revalidateResourceData();
    } catch (e) {
      alert("Xóa thư mục thất bại: " + e.message);
    }
  };


  async function handleDelete(id, displayName) {
    if (!confirm(`Xóa "${displayName}"? Thao tác này không thể hoàn tác.`)) return;
    try {
      console.log("Deleting resource:", id);
      await deleteDoc(doc(db, "resources", id));
      setResources((prev) => prev.filter((r) => r.id !== id));
      await revalidateResourceData();
    } catch (e) {
      console.error("Delete failed:", e);
      alert("Xóa thất bại: " + e.message);
    }
  }
  return (
    <>
      <AdminDropOverlay isDragging={isDragging} />
      <UploadDrawer 
        files={stagingFiles}
        isOpen={stagingFiles.length > 0}
        onClose={clearAll} 
        onUpdate={updateFileMeta}
        onRemove={removeFile}
        onUpload={uploadAll}
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
          onDropResource={handleDropResource}
          onDeleteFolder={handleDeleteFolder}
        />
      </aside>

      <main className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <div className={styles.topActions}>
            <div className={styles.titleSection}>
              <h1>Quản lý tài nguyên</h1>
              <span className={styles.subtitle}>{filtered.length} tài nguyên trong mục này</span>
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
        </div>

        <div className={styles.scrollArea}>
          <div className={`${styles.resourceGrid} ${viewMode === 'list' ? styles.listMode : ''}`}>
            {viewMode === 'list' && filtered.length > 0 && !loading && (
              <div className={styles.listHeader}>
                <div className={styles.colName}>Tên tài nguyên</div>
                <div className={styles.colDate}>Ngày tạo</div>
                <div className={styles.colSize}>Dung lượng</div>
                <div className={styles.colActions}>Thao tác</div>
              </div>
            )}
            {loading ? (
              <div className={styles.loadingBox}>
                <Loader2 size={32} className={styles.loadingIcon} />
                <p>Đang đồng bộ dữ liệu...</p>
              </div>
            ) : filtered.length > 0 ? (
              filtered.map((r) => (
                <div 
                  key={r.id} 
                  className={`${styles.card} ${viewMode === 'list' ? styles.listRow : ''}`}
                  draggable
                  onDragStart={(e) => handleResourceDragStart(e, r)}
                >
                  {viewMode === 'grid' ? (
                    <>
                      <div className={styles.cardPreview}>
                        <div className={styles.cardIcon}>
                          <LayoutGrid size={48} strokeWidth={1} />
                        </div>
                        <div className={styles.cardOverlay}>
                          <Link href={`/admin/resources/${r.id}`} className={`${styles.actionBtn} ${styles.edit}`}>
                            <Edit2 size={18} />
                          </Link>
                          <button
                            className={`${styles.actionBtn} ${styles.delete}`}
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
                        <h3 className={styles.cardTitle}>{r.name || r.fileName || "Untitled"}</h3>
                        <div className={styles.cardMeta}>
                          <span className={styles.formatBadge}>{r.fileFormat}</span>
                          <span>{r.category}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={styles.listColName}>
                        <div className={styles.listIconSmall}>
                          <LayoutGrid size={20} strokeWidth={1.5} />
                        </div>
                        <div className={styles.listNameInfo}>
                          <span className={styles.listTitle}>{r.name || r.fileName || "Untitled"}</span>
                          <span className={styles.listCategory}>{r.category} • {r.fileFormat}</span>
                        </div>
                      </div>
                      <div className={styles.listColDate}>
                        {r.createdAt ? new Date(r.createdAt.seconds * 1000).toLocaleDateString('vi-VN') : '---'}
                      </div>
                      <div className={styles.listColSize}>
                        {r.fileSize ? (r.fileSize / 1024 / 1024).toFixed(2) + ' MB' : '---'}
                      </div>
                      <div className={styles.listColActions}>
                        <Link href={`/admin/resources/${r.id}`} className={styles.inlineActionBtn}>
                          <Edit2 size={16} />
                        </Link>
                        <button 
                          className={`${styles.inlineActionBtn} ${styles.delete}`}
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
        </div>
      </main>
      </div>
    </>
  );
}

