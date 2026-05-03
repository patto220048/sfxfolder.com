"use client";

import { memo, useTransition, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import FilterBar from "@/app/components/ui/FilterBar";
import { mediaManager } from "@/app/lib/mediaManager";

const FilterSection = memo(function FilterSection({
  info,
  selectedFormats,
  setSelectedFormats,
  availableTags,
  selectedTags,
  setSelectedTags,
  sortBy,
  setSortBy,
  inPageSearch,
  setInPageSearch,
  resSlug,
  breadcrumbs,
  handleSelectFolder,
  updateUrl,
  router,
  pathname,
  folders,
  findInTree,
  isLoading,
  isPlugin = false
}) {
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Đồng bộ Format URL sau khi người dùng ngừng thao tác
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentFormatsStr = searchParams.get("format") || "";
      const newFormatsStr = selectedFormats.join(",");
      if (currentFormatsStr !== newFormatsStr) {
        updateUrl({ format: selectedFormats });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [selectedFormats, updateUrl, searchParams]);

  // Đồng bộ Tag URL sau khi người dùng ngừng thao tác
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentTagsStr = searchParams.get("tags") || "";
      const newTagsStr = selectedTags.join(",");
      if (currentTagsStr !== newTagsStr) {
        updateUrl({ tags: selectedTags });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [selectedTags, updateUrl, searchParams]);

  const handleFormatsChange = (vals) => {
    mediaManager.stopAll();
    startTransition(() => {
      setSelectedFormats(vals);
    });
  };

  const handleTagsChange = (vals) => {
    mediaManager.stopAll();
    startTransition(() => {
      setSelectedTags(vals);
    });
  };

  const handleSortChange = (val) => {
    mediaManager.stopAll();
    startTransition(() => {
      setSortBy(val);
      updateUrl({ sort: val });
    });
  };

  const handleBreadcrumbClick = (id) => {
    mediaManager.stopAll();
    if (!id) handleSelectFolder(null);
    else {
      const folder = findInTree(folders, id);
      if (folder?.current) handleSelectFolder(folder.current);
    }
  };

  return (
    <FilterBar
      formats={info.formats}
      selectedFormats={selectedFormats}
      onFormatsChange={handleFormatsChange}
      tags={availableTags}
      selectedTags={selectedTags}
      onTagsChange={handleTagsChange}
      sortBy={sortBy}
      onSortChange={handleSortChange}
      inPageSearch={inPageSearch}
      onSearchChange={setInPageSearch}
      resSlug={resSlug}
      onClearRes={() => router.push(pathname)}
      primaryColor={info.color}
      breadcrumbs={breadcrumbs}
      categoryName={info.name}
      onBreadcrumbClick={handleBreadcrumbClick}
      isLoading={isLoading}
      isPlugin={isPlugin}
    />
  );
});

export default FilterSection;
