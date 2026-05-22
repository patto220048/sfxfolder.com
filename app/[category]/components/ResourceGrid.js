'use client';

import React, { memo, useMemo } from "react";
import { List } from "react-window";
import { AutoSizer } from "react-virtualized-auto-sizer";
import ResourceCard from "@/app/components/ui/ResourceCard";
import FolderCard from "@/app/components/ui/FolderCard";
import SoundButton from "@/app/components/ui/SoundButton";
import styles from "../page.module.css";

// Row renderer outside component to prevent re-creation
const Row = memo(({ index, style, columnCount, flatItems, rowCount, category, onPreview, router, handleSelectFolder, info, hasMoreDB, isLoadingMore, isPlugin, highlightSlug }) => {
  
  if (index === rowCount - 1 && (isLoadingMore || hasMoreDB)) {
    return (
      <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className={styles.infiniteLoader}>
          <span className={styles.loaderIcon}></span>
          <span>Loading more...</span>
        </div>
      </div>
    );
  }

  const startIndex = index * columnCount;
  const rowItems = flatItems.slice(startIndex, startIndex + columnCount);

  if (!rowItems || rowItems.length === 0) return null;

  return (
    <div
      style={{
        ...style,
        display: "grid",
        gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
        gap: isPlugin ? "10px" : (info.layout === "audio" || info.layout === "sound" ? "16px" : "24px"),
        padding: isPlugin ? "6px 10px" : "12px 16px",
        boxSizing: "border-box",
        alignItems: "start",
      }}
    >
      {rowItems.map((item, i) =>
        item._isFolder ? (
          <FolderCard
            key={item.id || `folder-${startIndex + i}`}
            folder={item}
            onClick={() => handleSelectFolder(item)}
            primaryColor={info.color}
            index={startIndex + i}
          />
        ) : (
          (info.layout === "audio" || info.layout === "sound") ? (
            <SoundButton
              key={item.id || `sound-${startIndex + i}`}
              {...item}
              sound={item}
              downloadUrl={item.downloadUrl || item.fileUrl}
              index={startIndex + i}
              onPreview={(itemToPreview) => {
                const targetItem = itemToPreview || item;
                if (!isPlugin && targetItem.slug) {
                  router.push(`/${category}/${targetItem.slug}`);
                } else {
                  onPreview(targetItem);
                }
              }}
              primaryColor={info.color}
              info={info}
              isPlugin={isPlugin}
              isHighlighted={item.slug === highlightSlug}
            />
          ) : (
            <ResourceCard
              key={item.id || `resource-${startIndex + i}`}
              {...item}
              resource={item}
              downloadUrl={item.downloadUrl || item.fileUrl}
              cardType={
                (info.layout === "video" || info.layout === "image" || info.layout === "font" || info.layout === "lut") ? info.layout :
                (category === "green-screen" || category === "greenscreen" || category === "video-meme" || category === "animation") ? "video" : 
                category === "image-overlay" ? "image" :
                (category === "preset-lut" || category === "lut") ? "lut" :
                "video"
              }
              index={startIndex + i}
              onPreview={() => onPreview(item)}
              detailUrl={(!isPlugin && item.slug) ? `/${category}/${item.slug}` : null}
              primaryColor={info.color}
              info={info}
              isPlugin={isPlugin}
              isHighlighted={item.slug === highlightSlug}
            />
          )
        )
      )}
    </div>
  );
});

Row.displayName = "ResourceGridRow";

/**
 * Optimized ResourceGrid using react-window (v2.2.7) for virtualization.
 * Note: react-virtualized-auto-sizer v2.x requires the 'renderProp' prop instead of children.
 */
const ResourceGrid = ({
  filteredResources = [],
  currentSubfolders = [],
  info = {},
  slug,
  handleSelectFolder,
  onPreview,
  isInitialLoading,
  isFetchLoading,
  isPending,
  router,
  inPageSearch,
  selectedFormats,
  selectedTags,
  resSlug,
  onLoadMore,
  hasMoreDB,
  isLoadingMore,
  isPlugin = false,
  highlightSlug,
  selectedFolderId,
}) => {
  const listRef = React.useRef(null);
  const lastScrolledSlugRef = React.useRef(null);
  const prevFolderIdRef = React.useRef(selectedFolderId);
  const prevSlugRef = React.useRef(slug);
  
  const [activeHighlightSlug, setActiveHighlightSlug] = React.useState(null);

  React.useEffect(() => {
    if (highlightSlug) {
      setActiveHighlightSlug(highlightSlug);
    } else if (selectedFolderId !== prevFolderIdRef.current || slug !== prevSlugRef.current) {
      setActiveHighlightSlug(null);
    }
    prevFolderIdRef.current = selectedFolderId;
    prevSlugRef.current = slug;
  }, [highlightSlug, selectedFolderId, slug]);
  
  const isFiltering = inPageSearch || selectedFormats?.length > 0 || selectedTags?.length > 0 || resSlug;
  const isSoundLayout = info.layout === "audio" || info.layout === "sound";
  const isLoading = isInitialLoading || isFetchLoading || isPending;

  const flatItems = useMemo(() => {
    const list = [];
    let highlightedItem = null;
    const folderList = [];
    const resourcesList = [];

    if (!isFiltering) {
      currentSubfolders.forEach((f) => folderList.push({ ...f, _isFolder: true }));
    }
    
    filteredResources.forEach((i) => {
      const resourceWithFlag = { ...i, _isResource: true };
      if (activeHighlightSlug && i.slug === activeHighlightSlug) {
        highlightedItem = resourceWithFlag;
      } else {
        resourcesList.push(resourceWithFlag);
      }
    });

    if (highlightedItem) {
      list.push(highlightedItem);
    }
    
    list.push(...folderList);
    list.push(...resourcesList);
    return list;
  }, [currentSubfolders, filteredResources, isFiltering, activeHighlightSlug]);

  const getColumnCount = React.useCallback((width) => {
    if (isPlugin) {
      // Aggressive breakpoints to ensure we drop columns in Premiere Pro panels
      if (width > 850) return 4;
      if (width > 550) return 3; // Need ~760px panel width for 3 columns
      if (width > 300) return 2; // Need ~510px panel width for 2 columns
      return 1; // Below ~510px panel width, go to 1 column
    }
    
    if (isSoundLayout) {
      return width > 1400 ? 3 : width > 900 ? 2 : 1;
    }
    return width > 1200 ? 4 : width > 900 ? 3 : width > 768 ? 2 : 1;
  }, [isPlugin, isSoundLayout]);

  React.useEffect(() => {
    if (highlightSlug && highlightSlug !== lastScrolledSlugRef.current && flatItems.length > 0) {
      const highlightIndex = flatItems.findIndex(item => !item._isFolder && item.slug === highlightSlug);
      if (highlightIndex >= 0) {
        lastScrolledSlugRef.current = highlightSlug;
        
        // Scroll to the first row (row 0) where the highlighted item is ginned
        setTimeout(() => {
          listRef.current?.scrollToItem(0, "center");
        }, 100);

        // Clear highlight parameter from URL after animation completes
        const timer = setTimeout(() => {
          if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            if (params.has("highlight")) {
              params.delete("highlight");
              const newUrl = `${window.location.pathname}?${params.toString()}`;
              window.history.replaceState(null, "", newUrl);
            }
          }
        }, 2500);

        return () => clearTimeout(timer);
      }
    }
  }, [highlightSlug, flatItems, getColumnCount]);

  const getRowHeight = (index, currentColumnCount) => {
    // Plugin mode needs a bit more height for spacing between rows
    const pluginRowHeight = 66; // 54px card + 12px vertical padding
    
    if (isSoundLayout) return isPlugin ? pluginRowHeight : 86;
    
    const hasLoader = hasMoreDB || isLoadingMore;
    const baseRowCount = Math.ceil(flatItems.length / currentColumnCount);
    
    // Loader row
    if (hasLoader && index === baseRowCount) return 100;

    const startIndex = index * currentColumnCount;
    const rowItems = flatItems.slice(startIndex, startIndex + currentColumnCount);
    
    // If no items in row (shouldn't happen), default to resource height
    if (rowItems.length === 0) return isPlugin ? pluginRowHeight : 404;
    
    // Check if the row contains any resources
    const hasResource = rowItems.some(item => !item._isFolder);
    
    if (hasResource) return isPlugin ? pluginRowHeight : 404;
    return isPlugin ? pluginRowHeight : 86; // Match audio row height
  };

  if (isLoading && flatItems.length === 0) {
    return (
      <div className={isPlugin ? styles.pluginGridWrapper : styles.gridWrapper}>
        <div className={isSoundLayout ? (isPlugin ? styles.pluginSoundGrid : styles.soundGrid) : (isPlugin ? styles.pluginGrid : styles.grid)}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className={isSoundLayout ? styles.skeletonCardSound : styles.skeletonCard} />
          ))}
        </div>
      </div>
    );
  }

  if (!isLoading && flatItems.length === 0) {
    return <div className={styles.empty}><p>No resources found.</p></div>;
  }

  const wrapperStyle = isPlugin 
    ? { flex: 1, width: '100%', minHeight: '300px', position: 'relative' } 
    : { height: 'calc(100vh - 280px)', minHeight: '600px', width: '100%' };

  return (
    <div className={isPlugin ? styles.pluginGridWrapper : styles.gridWrapper} style={wrapperStyle}>
      <AutoSizer 
        renderProp={({ height, width }) => {
          // Fallback to prevent hidden content if dimensions are 0
          const finalHeight = height > 0 ? height : (isPlugin ? 500 : 800);
          const finalWidth = width > 0 ? width : 1000;
          
          const columnCount = getColumnCount(finalWidth);
          const baseRowCount = Math.ceil(flatItems.length / columnCount);
          const hasLoader = hasMoreDB || isLoadingMore;
          const rowCount = baseRowCount + (hasLoader ? 1 : 0);
          
          return (
            <List
              ref={listRef}
              key={`${columnCount}-${isSoundLayout}`}
              rowCount={rowCount}
              rowHeight={(index) => getRowHeight(index, columnCount)}
              rowComponent={Row}
              rowProps={{ 
                columnCount, 
                flatItems, 
                rowCount, 
                category: slug, 
                onPreview,
                router,
                handleSelectFolder,
                info,
                hasMoreDB,
                isLoadingMore,
                isPlugin,
                containerWidth: finalWidth,
                highlightSlug
              }}
              onRowsRendered={({ stopIndex }) => {
                if (stopIndex >= rowCount - 1 && hasMoreDB && !isLoadingMore) {
                  if (onLoadMore) onLoadMore();
                }
              }}
              className={isPending ? styles.gridLoading : "scrollbar-hide"}
              style={{ width: finalWidth, height: finalHeight }}
            />
          );
        }}
      />
    </div>
  );
};

ResourceGrid.displayName = "ResourceGrid";

export default memo(ResourceGrid);
