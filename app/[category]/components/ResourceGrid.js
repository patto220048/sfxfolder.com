'use client';

import React, { memo, useMemo } from "react";
import { List } from "react-window";
import { AutoSizer } from "react-virtualized-auto-sizer";
import ResourceCard from "@/app/components/ui/ResourceCard";
import FolderCard from "@/app/components/ui/FolderCard";
import SoundButton from "@/app/components/ui/SoundButton";
import styles from "../page.module.css";

// Row renderer outside component to prevent re-creation
const Row = memo(({ index, style, columnCount, flatItems, rowCount, category, onPreview, router, handleSelectFolder, info, hasMoreDB, isLoadingMore, isPlugin, highlightSlug, isScrolling }) => {
  
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
        willChange: "transform",
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
            isScrolling={isScrolling}
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
              isScrolling={isScrolling}
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
              isScrolling={isScrolling}
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
  const highlightFolderIdRef = React.useRef(selectedFolderId);
  const highlightSlugCategoryRef = React.useRef(slug);
  
  const [activeHighlightSlug, setActiveHighlightSlug] = React.useState(null);
  const [isScrolling, setIsScrolling] = React.useState(false);
  const scrollTimeoutRef = React.useRef(null);
  const lastScrollTopRef = React.useRef(0);
  const lastScrollTimeRef = React.useRef(0);

  const handleScroll = React.useCallback((e) => {
    const scrollTop = e.currentTarget.scrollTop;
    const now = performance.now();
    
    const timeDelta = now - lastScrollTimeRef.current;
    const scrollDelta = Math.abs(scrollTop - lastScrollTopRef.current);
    
    lastScrollTopRef.current = scrollTop;
    lastScrollTimeRef.current = now;

    // Calculate scroll velocity (px/ms)
    const velocity = timeDelta > 0 ? scrollDelta / timeDelta : 0;

    // Threshold for fast scroll: 1.5px/ms (1500px/s)
    const isScrollingFast = velocity > 1.5;

    if (isScrollingFast) {
      if (!isScrolling) {
        setIsScrolling(true);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    } else {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 50); // fast recovery for low velocity
    }
  }, [isScrolling]);

  React.useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Synchronously reset activeHighlightSlug in render phase if folder or category changes
  if (selectedFolderId !== highlightFolderIdRef.current || slug !== highlightSlugCategoryRef.current) {
    highlightFolderIdRef.current = selectedFolderId;
    highlightSlugCategoryRef.current = slug;
    lastScrolledSlugRef.current = null; // Reset scroll target ref on folder/category change
    if (highlightSlug) {
      setActiveHighlightSlug(highlightSlug);
    } else {
      setActiveHighlightSlug(null);
    }
  }

  React.useEffect(() => {
    if (highlightSlug) {
      setActiveHighlightSlug(highlightSlug);
      highlightFolderIdRef.current = selectedFolderId;
      highlightSlugCategoryRef.current = slug;
    } else if (selectedFolderId !== highlightFolderIdRef.current || slug !== highlightSlugCategoryRef.current) {
      setActiveHighlightSlug(null);
    }
  }, [highlightSlug, selectedFolderId, slug]);

  // Reset scroll ref when highlightSlug is cleared, allowing clicking same item again
  React.useEffect(() => {
    if (!highlightSlug) {
      lastScrolledSlugRef.current = null;
    }
  }, [highlightSlug]);
  
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
    const isLoading = isInitialLoading || isFetchLoading || isPending;
    if (highlightSlug && !isLoading && highlightSlug !== lastScrolledSlugRef.current && flatItems.length > 0) {
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
  }, [highlightSlug, flatItems, getColumnCount, isInitialLoading, isFetchLoading, isPending]);



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
          
          // Precompute row heights for O(1) lookup
          const pluginRowHeight = 66;
          const count = flatItems.length;
          const rowHeights = [];
          
          for (let index = 0; index < baseRowCount; index++) {
            if (isSoundLayout) {
              rowHeights.push(isPlugin ? pluginRowHeight : 86);
              continue;
            }
            
            const startIndex = index * columnCount;
            const endIndex = Math.min(startIndex + columnCount, count);
            let hasResource = false;
            for (let i = startIndex; i < endIndex; i++) {
              if (flatItems[i] && !flatItems[i]._isFolder) {
                hasResource = true;
                break;
              }
            }
            
            if (hasResource) {
              rowHeights.push(isPlugin ? pluginRowHeight : 404);
            } else {
              rowHeights.push(isPlugin ? pluginRowHeight : 86);
            }
          }
          if (hasLoader) {
            rowHeights.push(100);
          }

          const getRowHeight = (index) => {
            return rowHeights[index] || (isPlugin ? 66 : (isSoundLayout ? 86 : 404));
          };
          
          return (
            <List
              ref={listRef}
              key={`${columnCount}-${isSoundLayout}`}
              rowCount={rowCount}
              rowHeight={getRowHeight}
              rowComponent={Row}
              overscanCount={8}
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
                highlightSlug,
                isScrolling
              }}
              onScroll={handleScroll}
              onRowsRendered={({ stopIndex }) => {
                if (stopIndex >= rowCount - 1 && hasMoreDB && !isLoadingMore) {
                  if (onLoadMore) onLoadMore();
                }
              }}
              className={isPending ? styles.gridLoading : `scrollbar-hide ${isScrolling ? styles.scrolling : ""}`}
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
