"use client";

import { useState, useMemo, useEffect } from "react";
import { Folder, FolderOpen, ChevronRight, ChevronDown, Plus, Trash2 } from "lucide-react";
import styles from "./FolderTree.module.css";

const buildTree = (folders, parentId = null) => {
  return folders
    .filter((f) => f.parentId === parentId)
    .map((f) => ({
      ...f,
      children: buildTree(folders, f.id),
    }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
};

const FolderItem = ({ 
  folder, 
  level, 
  onSelect, 
  selectedId, 
  onAddSub, 
  onRenameFolder,
  onMoveFolder,
  onDropResource, 
  onDeleteFolder,
  expandedFolders,
  toggleFolder
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const isSelected = selectedId === folder.id;
  const isOpen = expandedFolders[folder.id];

  const handleDragStart = (e) => {
    e.stopPropagation();
    e.dataTransfer.setData("folderId", folder.id);
    e.dataTransfer.setData("sourceCategory", folder.categorySlug);
    // Add text/plain fallback for folders
    e.dataTransfer.setData("text/plain", `folder:${folder.id}:${folder.categorySlug}`);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const plainText = e.dataTransfer.getData("text/plain");
    const resourceIdsStr = e.dataTransfer.getData("resourceIds");
    const folderIdStr = e.dataTransfer.getData("folderId");

    // 1. Try Resource Move
    let rIds = null;
    if (resourceIdsStr) {
      try { rIds = JSON.parse(resourceIdsStr); } catch (e) {}
    } else if (plainText && plainText.startsWith("resources:")) {
      try { rIds = JSON.parse(plainText.replace("resources:", "")); } catch (e) {}
    }

    if (rIds && rIds.length > 0 && onDropResource) {
      return onDropResource(rIds, folder.id);
    }

    // 2. Try Folder Move
    let fId = folderIdStr;
    if (!fId && plainText && plainText.startsWith("folder:")) {
      fId = plainText.split(":")[1];
    }

    if (fId && fId !== folder.id && onMoveFolder) {
      onMoveFolder(fId, folder.id, folder.categorySlug);
    }
  };

  const handleRename = () => {
    if (editName.trim() && editName !== folder.name) {
      onRenameFolder(folder.id, editName.trim());
    }
    setIsEditing(false);
  };

  return (
    <div className={styles.itemWrapper}>
      <div 
        className={`${styles.item} ${isSelected ? styles.selected : ""} ${isDragOver ? styles.dragOver : ""}`}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
        onClick={() => onSelect(folder.id, folder.categorySlug)}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        draggable="true"
        onDragStart={handleDragStart}
      >
        <button 
          onClick={(e) => { e.stopPropagation(); toggleFolder(folder.id); }} 
          className={styles.toggleBtn}
        >
          {folder.children.length > 0 ? (
            isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <span style={{ width: 14 }} />
          )}
        </button>
        
        {isOpen ? <FolderOpen size={16} className={styles.folderIcon} /> : <Folder size={16} className={styles.folderIcon} />}
        
        {isEditing ? (
          <input
            className={styles.renameInput}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') {
                setEditName(folder.name);
                setIsEditing(false);
              }
            }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span 
            className={styles.name}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            {folder.name}
          </span>
        )}
        
        <div className={styles.itemActions}>
          {level < 3 && ( 
            <button 
              className={styles.addBtn} 
              onClick={(e) => { e.stopPropagation(); onAddSub(folder.id, folder.categorySlug); }}
              title="Thêm thư mục con"
            >
              <Plus size={12} />
            </button>
          )}
          <button 
            className={`${styles.addBtn} ${styles.deleteBtn}`} 
            onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder); }}
            title="Xóa thư mục"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {isOpen && folder.children.length > 0 && (
        <div className={styles.children}>
          {folder.children.map((child) => (
            <FolderItem 
              key={child.id} 
              folder={child} 
              level={level + 1} 
              onSelect={onSelect}
              selectedId={selectedId}
              onAddSub={onAddSub}
              onRenameFolder={onRenameFolder}
              onMoveFolder={onMoveFolder}
              onDropResource={onDropResource}
              onDeleteFolder={onDeleteFolder}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function FolderTree({ 
  folders, 
  onSelect, 
  selectedId, 
  categories, 
  onAddFolder,
  onRenameFolder,
  onMoveFolder,
  onDropResource,
  onDeleteFolder
}) {
  const [collapsedCats, setCollapsedCats] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [dragOverCat, setDragOverCat] = useState(null);

  // Load initial state from localStorage
  useEffect(() => {
    const savedCats = localStorage.getItem('admin_sidebar_collapsed_cats');
    if (savedCats) {
      try { setCollapsedCats(JSON.parse(savedCats)); } catch (e) {}
    }
    
    const savedFolders = localStorage.getItem('admin_sidebar_expanded_folders');
    if (savedFolders) {
      try { setExpandedFolders(JSON.parse(savedFolders)); } catch (e) {}
    } else {
      // Default: Expand first level folders if no saved state
      const initial = {};
      folders.forEach(f => {
        if (!f.parentId) initial[f.id] = true;
      });
      setExpandedFolders(initial);
    }
  }, [folders.length > 0]); // Only run once we have folders

  const toggleCategory = (slug, e) => {
    e.stopPropagation();
    const next = collapsedCats.includes(slug)
      ? collapsedCats.filter(s => s !== slug)
      : [...collapsedCats, slug];
    
    setCollapsedCats(next);
    localStorage.setItem('admin_sidebar_collapsed_cats', JSON.stringify(next));
  };

  const toggleFolder = (id) => {
    const next = { ...expandedFolders, [id]: !expandedFolders[id] };
    setExpandedFolders(next);
    localStorage.setItem('admin_sidebar_expanded_folders', JSON.stringify(next));
  };

  const handleCatDragOver = (e, slug) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOverCat(slug);
  };

  const handleCatDragEnter = (e, slug) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCat(slug);
  };

  const handleCatDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCat(null);
  };

  const handleCatDrop = (e, cat) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCat(null);
    
    const plainText = e.dataTransfer.getData("text/plain");
    const resourceIdsStr = e.dataTransfer.getData("resourceIds");
    const folderIdStr = e.dataTransfer.getData("folderId");

    // 1. Try Resource Move
    let rIds = null;
    if (resourceIdsStr) {
      try { rIds = JSON.parse(resourceIdsStr); } catch (e) {}
    } else if (plainText && plainText.startsWith("resources:")) {
      try { rIds = JSON.parse(plainText.replace("resources:", "")); } catch (e) {}
    }

    if (rIds && rIds.length > 0 && onDropResource) {
      return onDropResource(rIds, null);
    }

    // 2. Try Folder Move
    let fId = folderIdStr;
    if (!fId && plainText && plainText.startsWith("folder:")) {
      fId = plainText.split(":")[1];
    }

    if (fId && onMoveFolder) {
      onMoveFolder(fId, null, cat.slug);
    }
  };

  const treeByGlobal = useMemo(() => {
    const grouped = {};
    categories.forEach(cat => {
      const catFolders = folders.filter(f => f.categorySlug === cat.slug);
      grouped[cat.slug] = buildTree(catFolders, null);
    });
    return grouped;
  }, [folders, categories]);

  return (
    <div className={styles.tree}>
      <div className={styles.treeHeader}>
        <h4>Thư mục Explorer</h4>
      </div>

      <div className={styles.sections}>
        {categories.map((cat) => (
          <div key={cat.slug} className={styles.categorySection}>
            <div 
              className={`${styles.categoryHeader} ${selectedId === `cat-${cat.slug}` ? styles.selected : ""} ${dragOverCat === cat.slug ? styles.dragOver : ""}`}
              onClick={() => onSelect(`cat-${cat.slug}`, cat.slug)}
              onDragEnter={(e) => handleCatDragEnter(e, cat.slug)}
              onDragOver={(e) => handleCatDragOver(e, cat.slug)}
              onDragLeave={handleCatDragLeave}
              onDrop={(e) => handleCatDrop(e, cat)}
            >
              <button 
                className={`${styles.toggleBtn} ${collapsedCats.includes(cat.slug) ? styles.isCollapsed : ""}`}
                onClick={(e) => toggleCategory(cat.slug, e)}
              >
                {collapsedCats.includes(cat.slug) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
              
              <span className={styles.catName}>{cat.name}</span>
              <button 
                className={styles.addBtn} 
                onClick={(e) => { e.stopPropagation(); onAddFolder(null, cat.slug); }}
                title="Thêm thư mục gốc"
              >
                <Plus size={12} />
              </button>
            </div>
            
            {!collapsedCats.includes(cat.slug) && (
              <div className={styles.categoryContent}>
                {treeByGlobal[cat.slug]?.map((folder) => (
                  <FolderItem 
                    key={folder.id} 
                    folder={folder} 
                    level={0} 
                    onSelect={onSelect}
                    selectedId={selectedId}
                    onAddSub={onAddFolder}
                    onRenameFolder={onRenameFolder}
                    onMoveFolder={onMoveFolder}
                    onDropResource={onDropResource}
                    onDeleteFolder={onDeleteFolder}
                    expandedFolders={expandedFolders}
                    toggleFolder={toggleFolder}
                  />
                ))}
                {(!treeByGlobal[cat.slug] || treeByGlobal[cat.slug].length === 0) && (
                  <p className={styles.emptyText}>Chưa có thư mục</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
