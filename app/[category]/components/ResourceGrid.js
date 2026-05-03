'use client';

import React, { memo, useMemo } from "react";
import { List } from "react-window";
import { AutoSizer } from "react-virtualized-auto-sizer";
import ResourceCard from "@/app/components/ui/ResourceCard";
import FolderCard from "@/app/components/ui/FolderCard";
import SoundButton from "@/app/components/ui/SoundButton";
import styles from "../page.module.css";

// Row renderer outside component to prevent re-creation
const Row = memo(({ index, style, ...rowProps }) => {
  const { columnCount, flatItems, rowCount, category, onPreview, router, handleSelectFolder, info, hasMoreDB, isLoadingMore, isPlugin } = rowProps;
  
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
        gap: info.layout === "audio" || info.layout === "sound" ? "16px" : "24px",
        padding: "12px 16px",
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
              onPreview={() => item.slug ? router.push(`/${category}/${item.slug}`) : onPreview(item)}
              primaryColor={info.color}
              info={info}
              isPlugin={isPlugin}
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
              detailUrl={item.slug ? `/${category}/${item.slug}` : null}
              primaryColor={info.color}
              info={info}
              isPlugin={isPlugin}
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
  setPreviewResource,
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
}) => {
  const isFiltering = inPageSearch || selectedFormats?.length > 0 || selectedTags?.length > 0 || resSlug;
  const isSoundLayout = info.layout === "audio" || info.layout === "sound";
  const isLoading = isInitialLoading || isFetchLoading || isPending;

  const flatItems = useMemo(() => {
    const list = [];
    if (!isFiltering) {
      currentSubfolders.forEach((f) => list.push({ ...f, _isFolder: true }));
    }
    filteredResources.forEach((i) => list.push({ ...i, _isResource: true }));
    return list;
  }, [currentSubfolders, filteredResources, isFiltering]);

  const getColumnCount = (width) => {
    if (isSoundLayout) {
      if (isPlugin) return width > 600 ? 2 : 1;
      return width > 1400 ? 3 : width > 900 ? 2 : 1;
    }
    if (isPlugin) return width > 600 ? 3 : width > 350 ? 2 : 1;
    return width > 1200 ? 4 : width > 900 ? 3 : width > 768 ? 2 : 1;
  };

  const getRowHeight = (index, currentColumnCount) => {
    if (isSoundLayout) return isPlugin ? 72 : 86;
    
    const hasLoader = hasMoreDB || isLoadingMore;
    const baseRowCount = Math.ceil(flatItems.length / currentColumnCount);
    
    // Loader row
    if (hasLoader && index === baseRowCount) return 100;

    const startIndex = index * currentColumnCount;
    const rowItems = flatItems.slice(startIndex, startIndex + currentColumnCount);
    
    // If no items in row (shouldn't happen), default to resource height
    if (rowItems.length === 0) return isPlugin ? 280 : 404;
    
    // Check if the row contains any resources
    const hasResource = rowItems.some(item => !item._isFolder);
    
    if (hasResource) return isPlugin ? 280 : 404;
    return isPlugin ? 72 : 86; // Match audio row height
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
          if (!height || !width) return null;
          
          const columnCount = getColumnCount(width);
          const baseRowCount = Math.ceil(flatItems.length / columnCount);
          const hasLoader = hasMoreDB || isLoadingMore;
          const rowCount = baseRowCount + (hasLoader ? 1 : 0);
          
          return (
            <List
              key={`${columnCount}-${isSoundLayout}-${isFiltering}`}
              rowCount={rowCount}
              rowHeight={(index) => getRowHeight(index, columnCount)}
              rowComponent={Row}
              rowProps={{ 
                columnCount, 
                flatItems, 
                rowCount, 
                category: slug, 
                onPreview: setPreviewResource,
                router,
                handleSelectFolder,
                info,
                hasMoreDB,
                isLoadingMore,
                isPlugin
              }}
              onRowsRendered={({ stopIndex }) => {
                if (stopIndex >= rowCount - 1 && hasMoreDB && !isLoadingMore) {
                  if (onLoadMore) onLoadMore();
                }
              }}
              className={isPending ? styles.gridLoading : "scrollbar-hide"}
              style={{ width, height }}
            />
          );
        }}
      />
    </div>
  );
};

ResourceGrid.displayName = "ResourceGrid";

export default memo(ResourceGrid);
