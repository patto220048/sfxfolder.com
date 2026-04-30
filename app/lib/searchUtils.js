import { supabase } from "./supabase";
import Fuse from "fuse.js";

const CACHE_KEY = "dam_search_index_v5";
const CACHE_TIME_KEY = "dam_search_index_time";
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

let fuseInstance = null;
let isBuilding = null; // Promise to prevent simultaneous fetches

export async function getOrBuildSearchIndex(forceRebuild = false) {
  // If memory instance exists, return it immediately
  if (fuseInstance && !forceRebuild) {
    return fuseInstance;
  }

  // Prevent multiple overlapping fetches in the same window
  if (isBuilding && !forceRebuild) {
    return isBuilding;
  }

  isBuilding = (async () => {
    try {
      // Check session storage first
      const cachedData = sessionStorage.getItem(CACHE_KEY);
      const cachedTime = sessionStorage.getItem(CACHE_TIME_KEY);

      if (!forceRebuild && cachedData && cachedTime) {
        const timeDiff = Date.now() - parseInt(cachedTime, 10);
        if (timeDiff < CACHE_TTL_MS) {
          const parsed = JSON.parse(cachedData);
          fuseInstance = createFuseInstance(parsed);
          return fuseInstance;
        }
      }

      // 1. Fetch Categories first to have a mapping
      const { data: categories } = await supabase
        .from('categories')
        .select('slug, name');
      
      const catMap = (categories || []).reduce((acc, c) => {
        acc[c.slug] = c.name;
        return acc;
      }, {});

      // 2. Fetch resources
      const { data: allResources, error: resError } = await supabase
        .from('resources')
        .select('id, name, description, category_id, folder_id, file_format, tags, slug, download_url, preview_url, thumbnail_url, file_size, download_count')
        .eq('is_published', true);
      
      // 3. Fetch folders
      const { data: allFolders, error: folderError } = await supabase
        .from('folders')
        .select('id, name, parent_id, category_id, categories(slug)');
      
      if (folderError) throw folderError;

      // Transform resources
      const transformedResources = allResources.map(res => ({
        id: res.id,
        type: 'resource',
        name: res.name || "",
        description: res.description || "",
        category: catMap[res.category_id] || res.category_id || "",
        categorySlug: res.category_id || "",
        folderId: res.folder_id || null,
        fileFormat: res.file_format || "",
        tags: res.tags || [],
        slug: res.slug || "",
        downloadUrl: res.download_url || "",
        previewUrl: res.preview_url || "",
        thumbnailUrl: res.thumbnail_url || "",
        fileSize: res.file_size || 0,
        downloadCount: res.download_count || 0
      }));

      // Transform folders
      const transformedFolders = (allFolders || []).map(f => {
        const catSlug = f.categories?.slug || f.category_id || "";
        return {
          id: f.id,
          type: 'folder',
          name: f.name || "",
          category: catMap[catSlug] || catSlug || "",
          categorySlug: catSlug,
          parentId: f.parent_id || null,
          slug: f.id, // Use ID as slug for folders if they don't have one
          tags: ['folder'],
          fileFormat: "", // Folders have no format, match empty format filter
          description: `Folder in ${catMap[catSlug] || catSlug}`
        };
      });

      const combined = [...transformedResources, ...transformedFolders];

      // Save to sessionStorage
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(combined));
        sessionStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      } catch (e) {
        console.warn("Could not save search index to sessionStorage", e);
      }

      fuseInstance = createFuseInstance(combined);
      return fuseInstance;
    } catch (e) {
      console.error("Error building search index:", e);
      throw e;
    } finally {
      isBuilding = null;
    }
  })();

  return isBuilding;
}

function createFuseInstance(dataList) {
  return new Fuse(dataList, {
    keys: [
      { name: "name", weight: 1.0 },
      { name: "tags", weight: 0.8 },
      { name: "category", weight: 0.6 },
      { name: "description", weight: 0.4 },
    ],
    includeScore: true,
    includeMatches: true,
    threshold: 0.4, // Tightened slightly for better accuracy
    ignoreLocation: true,
    useExtendedSearch: true
  });
}

/**
 * Searches the in-memory/cached index for a given term.
 * @param {string} term 
 * @param {number} limit 
 * @returns Array of formatted results with original item & match info
 */
export async function searchResourcesClient(term, options = {}) {
  const fuse = await getOrBuildSearchIndex();
  if (!fuse) return [];

  // Robustly get the list of items
  const list = fuse.list || (fuse.getIndex && fuse.getIndex().docs) || [];
  const limitCount = options.limit || 200;

  let results = [];

  if (!term || !term.trim()) {
    results = list;
  } else {
    const fuseResults = fuse.search(term.trim(), { limit: limitCount });
    results = fuseResults.map(result => ({
      ...result.item,
      matches: result.matches
    }));
  }

  // Apply filters if present
  if (options.category || options.format) {
    results = results.filter(item => {
      // Use categorySlug for reliable matching with the slug passed from UI
      const catMatch = !options.category || item.categorySlug === options.category;
      const fmtMatch = !options.format || item.fileFormat === options.format;
      return catMatch && fmtMatch;
    });
  }

  return results.slice(0, limitCount);
}
