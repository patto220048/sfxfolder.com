import { supabase } from "./supabase";
import Fuse from "fuse.js";

const CACHE_KEY = "dam_search_index";
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
  if (isBuilding) {
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

      // If no cache or expired, fetch from Supabase
      const { data: allResources, error } = await supabase
        .from('resources')
        .select('id, name, description, category_id, file_format, tags, slug, download_url, preview_url, thumbnail_url, file_size, download_count, categories(slug, name)')
        .eq('is_published', true);
      
      if (error) throw error;

      // Transform snake_case to camelCase for Fuse.js
      const transformed = allResources.map(res => ({
        id: res.id,
        name: res.name || "",
        description: res.description || "",
        category: res.categories?.name || "",
        categorySlug: res.categories?.slug || "",
        fileFormat: res.file_format || "",
        tags: res.tags || [],
        slug: res.slug || "",
        downloadUrl: res.download_url || "",
        previewUrl: res.preview_url || "",
        thumbnailUrl: res.thumbnail_url || "",
        fileSize: res.file_size || 0,
        downloadCount: res.download_count || 0
      }));

      // Save to sessionStorage
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(transformed));
        sessionStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      } catch (e) {
        // QuotaExceededError is possible but unlikely with < 5000 items
        console.warn("Could not save search index to sessionStorage", e);
      }

      fuseInstance = createFuseInstance(transformed);
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
    includeMatches: true, // For highlighting
    threshold: 0.6, // 0.0 is perfect match, 1.0 is match anything
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
export async function searchResourcesClient(term, limitCount = 200) {
  if (!term || !term.trim()) return [];
  
  const fuse = await getOrBuildSearchIndex();
  if (!fuse) return [];

  const fuseResults = fuse.search(term.trim(), { limit: limitCount });
  
  return fuseResults.map(result => ({
    ...result.item,
    matches: result.matches // pass down matches for highlighting
  }));
}
