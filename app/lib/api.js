import { supabase } from './supabase';
import { unstable_cache } from 'next/cache';
import { deleteFile } from './storage';

// Cache configuration: 24h if enabled, else 0 (disabled)
const ENABLE_CACHE = process.env.NEXT_PUBLIC_ENABLE_CACHE === 'true';
const CACHE_24H = 86400; // 24 hours in seconds
export const REVALIDATE_TIME = ENABLE_CACHE ? CACHE_24H : false; // Use env variable to control cache

/* ========================================
   RESOURCES
   ======================================== */

/**
 * Essential columns for listing/grid view to minimize database egress and JSON payload size.
 */
export const RESOURCE_SUMMARY_COLUMNS = 'id, name, slug, category_id, folder_id, file_format, file_size, file_name, tags, download_count, preview_url, thumbnail_url, download_url, is_premium, created_at, categories!inner(slug, name), folders(name)';

/**
 * Full details for single resource page or edit mode.
 */
export const RESOURCE_DETAIL_COLUMNS = '*, categories(slug, name), folders(name)';

/**
 * Helper to map DB resource to Frontend resource
 */
export function mapResource(res) {
  if (!res) return null;
  return {
    ...res,
    categoryId: res.category_id || res.category_slug, // Handle both old and new schema
    folderId: res.folder_id,
    fileFormat: res.file_format || (res.name && res.name.includes('.') ? res.name.split('.').pop() : (res.file_name && res.file_name.includes('.') ? res.file_name.split('.').pop() : '')),
    fileSize: res.file_size,
    fileName: res.file_name,
    isPremium: res.is_premium,
    downloadCount: res.download_count,
    isPublished: res.is_published,
    downloadUrl: res.download_url,
    previewUrl: res.preview_url,
    thumbnailUrl: res.thumbnail_url,
    createdAt: res.created_at,
    updatedAt: res.updated_at,
    // Handle joined category and folder
    category: res.category || res.categories || null,
    folder: res.folder || res.folders || null,
  };
}

/**
 * Map profile data
 */
function mapProfile(data) {
  if (!data) return null;
  return {
    ...data,
    avatar_url: data.avatar_url || null,
  };
}

/**
 * Fetch a user profile, with proxy support on the client.
 */
export async function getProfile(userId) {
  if (!userId) return null;

  const isServer = typeof window === 'undefined';

  async function fetchLogic() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn("Error fetching profile:", error.message);
      return null;
    }
    return mapProfile(data);
  }

  // Use proxy on client to avoid connection limits during downloads
  if (!isServer) {
    try {
      const response = await fetch(`/api/profile?userId=${userId}&t=${Date.now()}`);
      if (!response.ok) throw new Error("Proxy profile fetch failed");
      const data = await response.json();
      return mapProfile(data);
    } catch (e) {
      console.error("Client profile fetch fallback:", e);
      return fetchLogic();
    }
  }

  return fetchLogic();
}

/**
 * Get a single resource by ID.
 */
export async function getResource(id) {
  const { data, error } = await supabase
    .from('resources')
    .select('id, name, description, slug, category_id, folder_id, file_format, file_size, file_name, file_type, tags, download_url, preview_url, thumbnail_url, storage_path, download_count, is_published, created_at, updated_at, categories(slug, name), folders(name)')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching resource:', error);
    return null;
  }
  return mapResource(data);
}

/**
 * Get a single resource by Slug.
 */
export async function getResourceBySlug(slug) {
  const { data, error } = await supabase
    .from('resources')
    .select(RESOURCE_SUMMARY_COLUMNS)
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.error('Error fetching resource by slug:', error);
    return null;
  }
  return data ? mapResource(data) : null;
}

/**
 * Get related resources based on vector similarity.
 * Returns resources with a 'similarity' score for UI display.
 */
export async function getRelatedResources(resourceId, limit = 6) {
  if (!resourceId) return [];

  try {
    // 1. Get the embedding from resource_embeddings and category from resources
    const { data: current, error: fetchError } = await supabase
      .from('resource_embeddings')
      .select('embedding, resources(category_id)')
      .eq('id', resourceId)
      .single();

    if (fetchError || !current?.embedding) {
      console.warn("Could not fetch embedding from resource_embeddings:", fetchError);
      return [];
    }

    const categoryId = current.resources?.category_id;

    // 2. Call the RPC v2 to match similar resources
    const { data, error } = await supabase.rpc('match_resources_v2', {
      query_embedding: current.embedding,
      match_threshold: 0.3,
      match_count: limit * 2,
      p_exclude_id: resourceId
    });

    if (error) {
      console.error('Error fetching related resources (v2):', error);
      return [];
    }

    if (!data || data.length === 0) return [];

    // 3. Fetch full details for these resources to get file_format, download_count, etc.
    const ids = data.map(item => item.id);
    const { data: details, error: detailsError } = await supabase
      .from('resources')
      .select(RESOURCE_SUMMARY_COLUMNS)
      .in('id', ids);

    if (detailsError) {
      console.error('Error fetching related details:', detailsError);
      // Fallback to minimal data if details fetch fails
    }

    // Create a map for quick lookup
    const detailsMap = (details || []).reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});

    // 4. Post-process: Boost same-category results and map
    const results = data.map(item => {
      const fullDetail = detailsMap[item.id] || {};
      let finalSimilarity = item.similarity;
      // Small boost for same category to improve relevance
      if (item.category_id === categoryId || fullDetail.category_id === categoryId) {
        finalSimilarity += 0.05;
      }

      return {
        ...mapResource({
          ...fullDetail,
          ...item, // RPC data takes precedence for similarity, but fullDetail provides missing fields
          categories: item.category_name 
            ? { name: item.category_name, slug: item.category_slug }
            : (fullDetail.categories || null)
        }),
        similarity: Math.min(0.99, finalSimilarity)
      };
    });

    // Sort by adjusted similarity and limit
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  } catch (err) {
    console.error('getRelatedResources failed:', err);
    return [];
  }
}

/**
 * Get resources with pagination, search and filtering.
 */
export async function getResources({ 
  categorySlug, 
  folderId, 
  searchTerm, 
  selectedTags = [], 
  selectedFormats = [],
  isAdmin = false,
  limit = 25, 
  offset = 0,
  sortOrder = "newest",
  abortSignal = null
} = {}) {
  // Key for cache should include all parameters
  const cacheKey = `resources-${categorySlug || "all"}-${folderId || "all"}-${searchTerm || "none"}-${selectedTags.join(",")}-${selectedFormats.join(",")}-${isAdmin ? "admin" : "public"}-${limit}-${offset}`;
  
  // If called from client, unstable_cache might not be available or needed.
  // We check if we are in a server context.
  const isServer = typeof window === 'undefined';

  const fetchLogic = async () => {
    let query;
    let isRPC = false;

    if (searchTerm) {
      isRPC = true;
      query = supabase.rpc('search_resources_fuzzy', {
        p_search_term: searchTerm,
        p_category_id: categorySlug,
        p_folder_id: folderId,
        p_limit: limit,
        p_offset: offset
      });
    } else {
      query = supabase
        .from("resources")
        .select(RESOURCE_SUMMARY_COLUMNS, { count: "exact" });

      // Handle sorting only for non-RPC (RPC has its own order)
      if (sortOrder === "oldest") {
        query = query.order("created_at", { ascending: true });
      } else if (sortOrder === "az") {
        query = query.order("name", { ascending: true });
      } else if (sortOrder === "za") {
        query = query.order("name", { ascending: false });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      query = query.range(offset, offset + limit - 1);

      if (!isAdmin) {
        query = query.eq("is_published", true);
      }
      
      if (categorySlug) {
        query = query.eq("category_id", categorySlug);
      }
      
      if (folderId !== undefined) {
        const isGlobalAction = (selectedTags && selectedTags.length > 0) || (selectedFormats && selectedFormats.length > 0);
        if (folderId !== null || !isGlobalAction) {
          if (folderId === null) {
            query = query.is("folder_id", null);
          } else if (Array.isArray(folderId)) {
            query = query.in("folder_id", folderId);
          } else {
            query = query.eq("folder_id", folderId);
          }
        }
      }
    }

    if (abortSignal) {
      query = query.abortSignal(abortSignal);
    }

    // Apply tags/formats filters only if not using RPC (RPC handles basic search)
    if (!isRPC) {
      if (selectedTags && selectedTags.length > 0) {
        query = query.contains("tags", selectedTags);
      }
      if (selectedFormats && selectedFormats.length > 0) {
        query = query.in("file_format", selectedFormats);
      }
    }

    const { data, error } = await query;
    if (error) {
      // Silently handle manual cancellations (AbortError)
      if (error.code === 'ABORT' || error.name === 'AbortError' || error.message?.includes('AbortError')) {
        return [];
      }
      
      // Handle "Requested range not satisfiable" (offset >= count)
      if (error.code === 'PGRST103') {
        return [];
      }

      console.error("Error fetching resources:", error);
      return [];
    }

    // Map data to match the expected format
    const mappedData = (data || []).map(item => {
      if (isRPC) {
        // Remap flat RPC fields to the structure expected by mapResource/UI
        return mapResource({
          ...item,
          categories: { name: item.category_name, slug: item.category_slug },
          folders: item.folder_name ? { name: item.folder_name } : null
        });
      }
      return mapResource(item);
    });

    return mappedData;
  };

  if (isServer && REVALIDATE_TIME !== false) {
    return unstable_cache(
      fetchLogic,
      [cacheKey],
      { revalidate: REVALIDATE_TIME, tags: ["resources"] }
    )();
  }

  // On client, route through our API to avoid connection limits with storage domain
  if (!isServer) {
    const params = new URLSearchParams();
    if (categorySlug) params.set("categorySlug", categorySlug);
    if (folderId !== undefined) params.set("folderId", folderId === null ? "null" : folderId);
    if (searchTerm) params.set("search", searchTerm);
    if (selectedTags.length) params.set("tags", selectedTags.join(","));
    if (selectedFormats.length) params.set("formats", selectedFormats.join(","));
    if (limit) params.set("limit", limit);
    if (offset) params.set("offset", offset);
    if (sortOrder) params.set("sort", sortOrder);

    try {
      const res = await fetch(`/api/resources?${params.toString()}`, { 
        signal: abortSignal,
        cache: 'no-store'
      });
      if (!res.ok) throw new Error("API failed");
      return await res.json();
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      console.error("Client fetch fallback to direct Supabase:", e);
      // Fallback to direct supabase if API fails
      return fetchLogic();
    }
  }

  return fetchLogic();
}

/**
 * Find resources using a hybrid of Full-Text Search and Trigram Similarity.
 * This provides the 'loose' search experience requested.
 */
export async function searchResources(searchQuery) {
  // Use a hybrid query: match via FTS or Similarity
  const { data, error } = await supabase
    .from('resources')
    .select('id, name, description, slug, category_id, folder_id, file_format, file_size, file_name, file_type, tags, download_url, preview_url, thumbnail_url, storage_path, download_count, is_published, created_at, updated_at, categories(slug, name, icon)')
    .eq('is_published', true)
    .or(`fts.wwebsearch.${searchQuery},name.ilike.%${searchQuery}%,tags.cs.{${searchQuery}}`)
    .limit(40);

  if (error) {
    console.error('Error searching resources:', error);
    return [];
  }
  return data.map(mapResource);
}

/**
 * Lightweight search for auto-suggestions.
 * Returns minimal data + category icons for performance.
 */
export async function getSearchSuggestions(query) {
  if (!query || query.length < 2) return [];

  // Fetch Resources
  const { data: resources, error: resError } = await supabase
    .from('resources')
    .select('id, name, slug, category_id, file_format, folder_id, categories(slug, icon), folders(name)')
    .eq('is_published', true)
    .or(`name.ilike.%${query}%,tags.cs.{${query}}`)
    .limit(5);

  // Fetch Folders
  const { data: folders, error: folderError } = await supabase
    .from('folders')
    .select('id, name, category_id, categories(slug, icon)')
    .ilike('name', `%${query}%`)
    .limit(3);

  if (resError) console.error('Error fetching resource suggestions:', resError);
  if (folderError) console.error('Error fetching folder suggestions:', folderError);

  const resourceSuggestions = (resources || []).map(item => ({
    id: item.id,
    type: 'resource',
    name: item.name,
    slug: item.slug,
    categorySlug: item.categories?.slug,
    categoryIcon: item.categories?.icon || 'box',
    format: item.file_format,
    folderId: item.folder_id,
    folderName: item.folders?.name
  }));

  const folderSuggestions = (folders || []).map(item => ({
    id: item.id,
    type: 'folder',
    name: item.name,
    categorySlug: item.categories?.slug,
    categoryIcon: 'folder',
    folderName: 'Folder'
  }));

  return [...folderSuggestions, ...resourceSuggestions];
}

/**
 * Helper to map Frontend resource to DB resource
 */
function mapToDB(data) {
  const result = { ...data };
  
  if ('categoryId' in data) { result.category_id = data.categoryId; delete result.categoryId; }
  if ('fileFormat' in data) { result.file_format = data.fileFormat; delete result.fileFormat; }
  if ('downloadCount' in data) { result.download_count = data.downloadCount; delete result.downloadCount; }
  if ('isPublished' in data) { result.is_published = data.isPublished; delete result.isPublished; }
  if ('downloadUrl' in data) { result.download_url = data.downloadUrl; delete result.downloadUrl; }
  if ('previewUrl' in data) { result.preview_url = data.previewUrl; delete result.previewUrl; }
  if ('thumbnailUrl' in data) { result.thumbnail_url = data.thumbnailUrl; delete result.thumbnailUrl; }
  if ('folderId' in data) { result.folder_id = data.folderId; delete result.folderId; }
  if ('fileSize' in data) { result.file_size = data.fileSize; delete result.fileSize; }
  if ('fileName' in data) { result.file_name = data.fileName; delete result.fileName; }
  if ('fileType' in data) { result.file_type = data.fileType; delete result.fileType; }
  if ('storagePath' in data) { result.storage_path = data.storagePath; delete result.storagePath; }
  if ('parentId' in data) { result.parent_id = data.parentId; delete result.parentId; }
  if ('categorySlug' in data) { result.category_id = data.categorySlug; delete result.categorySlug; }
  if ('category' in data) { result.category_id = data.category; delete result.category; }
  
  // Normalize empty strings to null for UUID/Foreign Key fields
  const uuidFields = ['folder_id', 'parent_id'];
  uuidFields.forEach(field => {
    if (result[field] === "") {
      result[field] = null;
    }
  });

  // Remove frontend-only joined objects
  delete result.category;
  delete result.categories;
  delete result.folder;
  delete result.folders;
  // Note: We MUST keep result.id for updates/upserts to work
  
  return result;
}

function mapFolder(folder) {
  if (!folder) return null;
  return {
    ...folder,
    parentId: folder.parent_id,
    categorySlug: folder.category_id || folder.category_slug, // Handle both old and new schema
    resourceCount: folder.resources?.[0]?.count || 0,
  };
}

/**
 * Add a new resource.
 */
export async function addResource(resourceData) {
  const dbData = mapToDB(resourceData);
  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('resources')
    .insert([{
      ...dbData,
      created_at: now,
      updated_at: now
    }])
    .select();

  if (error) {
    console.error('Error adding resource:', error);
    throw error;
  }
  
  if (!data || data.length === 0) {
    throw new Error('Đã thêm tài nguyên nhưng không nhận được dữ liệu trả về (có thể do lỗi phân quyền RLS).');
  }
  
  // Re-sync all tags to keep counts accurate
  await syncAllTagsFromResources().catch(e => console.error("Auto tag sync failed:", e));
  
  return mapResource(data[0]);
}

/**
 * Update an existing resource.
 */
export async function updateResource(id, updateData) {
  const dbData = mapToDB(updateData);
  const { data, error } = await supabase
    .from('resources')
    .update({
      ...dbData,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  // Re-sync all tags to keep counts accurate
  await syncAllTagsFromResources().catch(e => console.error("Auto tag sync failed:", e));

  if (error) {
    console.error('Error updating resource:', error);
    throw error;
  }
  return mapResource(data);
}

/**
 * Delete a resource.
 */
export async function deleteResource(id) {
  try {
    // 1. Fetch storage_path before deleting
    const { data: res } = await supabase
      .from('resources')
      .select('storage_path')
      .eq('id', id)
      .single();

    if (res?.storage_path) {
      // 2. Clear from storage (background failure ignored as per user request)
      deleteFile(res.storage_path).catch(err => 
        console.error(`Storage cleanup failed for resource ${id}:`, err)
      );
    }
  } catch (e) {
    console.warn(`Could not fetch storage_path for resource ${id}, proceeding with DB delete:`, e);
  }

  // 3. Delete DB record
  const { error } = await supabase
    .from('resources')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting resource record:', error);
    throw error;
  }

  // 4. Re-sync tags to keep counts accurate
  await syncAllTagsFromResources().catch(e => console.error("Auto tag sync failed after delete:", e));

  return true;
}

/**
 * Increment download count for a resource.
 */
export async function incrementDownloadCount(id) {
  // In Supabase/Postgres, we can use an RPC function for atomic increment 
  // or a simple update for low-concurrency cases.
  const { data, error } = await supabase.rpc('increment_download_count', { row_id: id });
  
  if (error) {
    // Fallback if RPC isn't defined yet
    console.warn('RPC increment_download_count not found, using manual update');
    const { data: current } = await supabase.from('resources').select('download_count').eq('id', id).maybeSingle();
    if (!current) return null;
    return supabase.from('resources').update({ download_count: (current?.download_count || 0) + 1 }).eq('id', id);
  }
  return data;
}

/* ========================================
   CATEGORIES
   ======================================== */

/**
 * Internal logic for categories with counts.
 */
async function fetchCategoriesWithCountsInternal() {
  const { data, error } = await supabase
    .from('categories')
    .select(`
      *,
      resources:resources(count)
    `)
    .order('order', { ascending: true });

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }

  // Map resources(count) to resourceCount for the frontend
  return (data || []).map(cat => ({
    ...cat,
    resourceCount: cat.resources?.[0]?.count || 0,
    formats: cat.formats || [] // Ensure formats is always an array
  }));
}

/**
 * Public version: Get all categories with resource counts using SQL Joins.
 * Cached for frontend performance.
 */
export const getCategoriesWithCounts = unstable_cache(
  fetchCategoriesWithCountsInternal,
  ['categories-with-counts'],
  { revalidate: REVALIDATE_TIME, tags: ['categories'] }
);

/**
 * Admin version: Always fresh, bypasses cache.
 */
export const getAdminCategoriesWithCounts = fetchCategoriesWithCountsInternal;

/**
 * Internal logic for simple categories list.
 */
async function fetchCategoriesInternal() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('order', { ascending: true });

  if (error) {
    console.error('Error fetching categories (simple):', error);
    return [];
  }
  return data || [];
}

/**
 * Public version: Cached for frontend.
 */
export const getCategories = unstable_cache(
  fetchCategoriesInternal,
  ['categories-simple'],
  { revalidate: REVALIDATE_TIME, tags: ['categories'] }
);

/**
 * Admin version: Always fresh.
 */
export const getAdminCategories = fetchCategoriesInternal;


async function fetchCategoryBySlugInternal(slug) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.error('Error fetching category by slug:', error);
    return null;
  }
  
  if (!data) return null;

  return {
    ...data,
    formats: data.formats || []
  };
}

export const getCategoryBySlug = unstable_cache(
  fetchCategoryBySlugInternal,
  ['category-by-slug'],
  { revalidate: REVALIDATE_TIME, tags: ['categories'] }
);


/**
 * Add a new category.
 */
export async function addCategory(categoryData) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('categories')
    .insert([{
      name: categoryData.name,
      slug: categoryData.slug,
      order: categoryData.order || 0,
      description: categoryData.description || null,
      layout: categoryData.layout || 'media',
      color: categoryData.color || '#FFFFFF',
      icon: categoryData.icon || 'box',
      formats: categoryData.formats || [],
      reference_image_url: categoryData.reference_image_url || null,
      created_at: now
    }])
    .select();

  if (error) {
    console.error('Error adding category:', error);
    throw error;
  }
  return data[0];
}

/**
 * Update a category.
 */
export async function updateCategory(id, updateData) {
  const { data, error } = await supabase
    .from('categories')
    .update({
      ...updateData
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating category:', error);
    throw error;
  }
  return data;
}

/**
 * Delete a category using the secure Admin API.
 * This performs a cascading delete: Resources -> Folders -> Category
 */
export async function deleteCategory(id) {
  // 1. Get the slug first since the API route needs it for cleanup
  const { data: category, error: fetchError } = await supabase.from('categories').select('slug').eq('id', id).single();
  if (fetchError || !category) {
    throw new Error("Không tìm thấy Category để xóa.");
  }

  const response = await fetch('/api/admin/categories', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: category.slug })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Xóa Category thất bại.");
  }

  return true;
}

/* ========================================
   FOLDERS
   ======================================== */

/**
 * Get folders for a category, optionally filtered by parent.
 */
export async function getFolders(categorySlug, parentId) {
  const isServer = typeof window === 'undefined';

  if (!isServer) {
    try {
      const params = new URLSearchParams();
      if (categorySlug) params.set("categorySlug", categorySlug);
      if (parentId) params.set("parentFolderId", parentId);
      
      const res = await fetch(`/api/folders?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error("API failed");
      return await res.json();
    } catch (e) {
      console.error("Client fetch folders fallback:", e);
      // Fallback logic below (direct supabase)
    }
  }

  // Define the fetch logic for folders
  const fetchFoldersLogic = async () => {
    let query = supabase
      .from('folders')
      .select('*, category:categories!inner(slug), resources:resources(count)')
      .eq('categories.slug', categorySlug)
      .order('order', { ascending: true });

    if (parentId !== undefined) {
      if (parentId === null) {
        query = query.is('parent_id', null);
      } else {
        query = query.eq('parent_id', parentId);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching folders:', error);
      return [];
    }
    return (data || []).map(mapFolder);
  };

  // If server and cache enabled, use unstable_cache
  if (isServer && REVALIDATE_TIME !== false) {
    return unstable_cache(
      fetchFoldersLogic,
      [`folders-${categorySlug}-${parentId || 'root'}`],
      { revalidate: REVALIDATE_TIME, tags: ['folders', 'resources'] }
    )();
  }

  // Default to direct fetch logic
  return fetchFoldersLogic();
}

/* ========================================
   TAGS
   ======================================== */

/**
 * Internal logic for tags list.
 */
async function fetchTagsInternal() {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('usage_count', { ascending: false });

  if (error) {
    console.error('Error fetching tags:', error);
    return [];
  }
  return (data || []).map(t => ({ ...t, usageCount: t.usage_count }));
}

/**
 * Public version: Cached for frontend.
 */
export const getTags = unstable_cache(
  fetchTagsInternal,
  ['tags-list'],
  { revalidate: REVALIDATE_TIME, tags: ['tags'] }
);

/**
 * Admin version: Always fresh.
 */
export const getAdminTags = fetchTagsInternal;

/**
 * Fetch all unique tags used within a specific category or a set of folders.
 * Highly optimized to only fetch the tags column.
 */
export async function getCategoryTags(categorySlug, folderIds = []) {
  if (!categorySlug) return [];

  const isServer = typeof window === 'undefined';

  const fetchLogic = async () => {
    let query = supabase
      .from('resources')
      .select('tags')
      .eq('category_id', categorySlug)
      .eq('is_published', true);

    if (folderIds && folderIds.length > 0) {
      query = query.in('folder_id', folderIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching tags:', error);
      return [];
    }

    const tagSet = new Set();
    data.forEach(item => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach(t => {
          if (t) tagSet.add(t.toLowerCase());
        });
      }
    });

    return Array.from(tagSet).sort();
  };

  const cacheKey = `category-tags-${categorySlug}-${folderIds.join(',') || 'all'}`;

  if (isServer && REVALIDATE_TIME !== false) {
    return unstable_cache(
      fetchLogic,
      [cacheKey],
      { revalidate: REVALIDATE_TIME, tags: ['resources', 'tags'] }
    )();
  }

  return fetchLogic();
}

/**
 * Helper to sync tags.
 * Increments or decrements usage_count for given tags.
 */
export async function syncTagsCount(addedTags = [], removedTags = []) {
  try {
    // 1. Handle added tags
    for (const tagName of addedTags) {
      const { data: existing } = await supabase
        .from('tags')
        .select('usage_count')
        .eq('name', tagName)
        .single();
      
      if (existing) {
        await supabase
          .from('tags')
          .update({ usage_count: (existing.usage_count || 0) + 1 })
          .eq('name', tagName);
      } else {
        await supabase
          .from('tags')
          .insert([{ name: tagName, usage_count: 1 }]);
      }
    }

    // 2. Handle removed tags
    for (const tagName of removedTags) {
      const { data: existing } = await supabase
        .from('tags')
        .select('usage_count')
        .eq('name', tagName)
        .single();
      
      if (existing && existing.usage_count > 0) {
        await supabase
          .from('tags')
          .update({ usage_count: Math.max(0, existing.usage_count - 1) })
          .eq('name', tagName);
      }
    }
  } catch (e) {
    console.error('Failed to sync tags count:', e);
  }
}

/* ========================================
   ADMIN & BATCH OPERATIONS
   ======================================== */

/**
 * Internal logic for admin folders.
 */
async function fetchAllAdminFoldersInternal() {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .order('order', { ascending: true });

  if (error) {
    console.error('Error fetching admin folders:', error);
    return [];
  }
  return (data || []).map(mapFolder);
}

/**
 * Public version: Get all folders (including unpublished/admin)
 * Cached for frontend.
 */
export const getAllAdminFolders = unstable_cache(
  fetchAllAdminFoldersInternal,
  ['admin-folders-list'],
  { revalidate: REVALIDATE_TIME, tags: ['folders'] }
);

/**
 * Admin version: Always fresh.
 */
export const getAdminFolders = fetchAllAdminFoldersInternal;

/**
 * Add a new folder.
 */
export async function addFolder(folderData) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('folders')
    .insert([{
      name: folderData.name,
      parent_id: folderData.parentId,
      category_id: folderData.categorySlug,
      order: folderData.order || 0,
      created_at: now,
      updated_at: now
    }])
    .select();

  if (error) {
    console.error('Error adding folder:', error);
    throw error;
  }
  
  if (!data || data.length === 0) {
    throw new Error('Đã thêm thư mục nhưng không nhận được dữ liệu trả về (có thể do lỗi phân quyền RLS).');
  }
  
  return mapFolder(data[0]);
}

/**
 * Update folder metadata.
 */
export async function updateFolder(id, updateData) {
  const dbEntry = mapToDB(updateData);
  const { data, error } = await supabase
    .from('folders')
    .update({
      ...dbEntry,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating folder:', error);
    throw error;
  }
  return mapFolder(data);
}

/**
 * Delete a folder.
 */
export async function deleteFolder(id) {
  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting folder:', error);
    throw error;
  }
  return true;
}

/**
 * Update multiple resources in batch.
 * Now uses a robust update approach to avoid NOT NULL constraint errors with upsert.
 */
export async function bulkUpdateResources(updates) {
  if (!updates || updates.length === 0) return [];

  // Sanitize updates (e.g. convert empty string folder_id to null for UUID compatibility)
  const sanitizedUpdates = updates.map(u => {
    const item = { ...u };
    if (item.folder_id === "") item.folder_id = null;
    if (item.folderId === "") item.folderId = null;
    // category_id is usually a slug string, but keep robust
    if (item.category_id === "") item.category_id = null;
    return item;
  });

  // Check if all updates are targeting the same folder_id AND same category_id (common case: Move)
  const first = sanitizedUpdates[0];
  const allSameFolder = sanitizedUpdates.every(u => u.folder_id === first.folder_id);
  const allSameCategory = sanitizedUpdates.every(u => u.category_id === first.category_id);

  // Check if updates contain ONLY id, folder_id, category_id, and updated_at
  // If they contain 'name', 'tags', etc., we MUST use the heterogeneous path
  // because those values are likely unique per item.
  const isPurelyStructural = sanitizedUpdates.every(u => {
    const keys = Object.keys(u);
    const structuralKeys = ['id', 'folder_id', 'folderId', 'category_id', 'categoryId', 'updated_at'];
    return keys.every(k => structuralKeys.includes(k));
  });

  if (allSameFolder && allSameCategory && isPurelyStructural) {
    const ids = sanitizedUpdates.map(u => u.id);
    const { data, error } = await supabase
      .from('resources')
      .update({
        folder_id: first.folder_id,
        category_id: first.category_id,
        updated_at: new Date().toISOString()
      })
      .in('id', ids)
      .select();

    if (error) {
      console.error('Error in bulk update (optimized):', error);
      throw error;
    }
    return data;
  }

  // Fallback for heterogeneous updates: Run in parallel
  const promises = sanitizedUpdates.map(u => {
    const dbEntry = mapToDB(u);
    return supabase
      .from('resources')
      .update({
        ...dbEntry,
        updated_at: new Date().toISOString()
      })
      .eq('id', u.id)
      .select(); // Added select() to get back data
  });

  const results = await Promise.all(promises);
  const errors = results.filter(r => r.error);
  
  if (errors.length > 0) {
    console.error('Error in bulk update (heterogeneous):', errors[0].error);
    throw errors[0].error;
  }
  
  return results.map(r => r.data?.[0]); // Flatten data results
}

/**
 * Delete multiple resources using the secure Admin API.
 * Handles storage cleanup and uses service role to bypass limitations.
 */
export async function bulkDeleteResources(ids) {
  if (!ids || ids.length === 0) return true;

  const response = await fetch('/api/admin/resources', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Xóa hàng loạt thất bại.");
  }

  // Re-sync tags on the background
  syncAllTagsFromResources().catch(e => console.error("Auto tag sync failed after bulk delete:", e));

  return true;
}

/**
 * Rename a tag globally across all resources and the tags table.
 */
export async function renameTagGlobally(oldName, newName) {
  try {
    // 1. Update the tags table
    const { error: tagError } = await supabase
      .from('tags')
      .update({ name: newName })
      .eq('name', oldName);
    
    if (tagError) throw tagError;

    // 2. Update resources array (Iterate in JS for safe array manipulation)
    const { data: resources, error: resError } = await supabase
      .from('resources')
      .select('id, tags')
      .contains('tags', [oldName]);

    if (resError) throw resError;

    let affected = 0;
    for (const res of resources) {
      const newTags = res.tags.map(t => t === oldName ? newName : t);
      const { error: updError } = await supabase
        .from('resources')
        .update({ tags: newTags })
        .eq('id', res.id);
      if (!updError) affected++;
    }

    return affected;
  } catch (e) {
    console.error('Rename tag failed:', e);
    throw e;
  }
}

/**
 * Delete a tag globally.
 */
export async function deleteTagGlobally(tagName) {
  try {
    // 1. Remove from tags table
    await supabase.from('tags').delete().eq('name', tagName);

    // 2. Remove from resources arrays
    const { data: resources, error: resError } = await supabase
      .from('resources')
      .select('id, tags')
      .contains('tags', [tagName]);

    if (resError) throw resError;

    let affected = 0;
    for (const res of resources) {
      const newTags = res.tags.filter(t => t !== tagName);
      const { error: updError } = await supabase
        .from('resources')
        .update({ tags: newTags })
        .eq('id', res.id);
      if (!updError) affected++;
    }

    return affected;
  } catch (e) {
    console.error('Delete tag failed:', e);
    throw e;
  }
}

/**
 * Scan all resources and rebuild the tags table from scratch.
 */
export async function syncAllTagsFromResources() {
  try {
    const { data, error } = await supabase.from('resources').select('tags');
    if (error) throw error;

    const tagCounts = {};
    data.forEach(res => {
      (res.tags || []).forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    // Clear existing tags
    await supabase.from('tags').delete().neq('usage_count', -1); 

    // Insert new counts
    const insertData = Object.entries(tagCounts).map(([name, usage_count]) => ({
      name, usage_count
    }));

    if (insertData.length > 0) {
      await supabase.from('tags').insert(insertData);
    }

    return insertData.length;
  } catch (e) {
    console.error('Sync all tags failed:', e);
    throw e;
  }
}

/* ========================================
   SITE SETTINGS
   ======================================== */

/**
 * Get global site settings (version, name, status, etc.)
 * Cached for performance.
 */
export const getSiteSettings = unstable_cache(
  async () => {
    const { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      console.warn('Cannot fetch site settings, using defaults:', error);
      return {
        site_name: 'SFXFolder.com',
        tagline: 'Free Resources for Video Editors',
        project_version: 'v 0.1.16.4',
        status_text: 'System Online'
      };
    }
    return data;
  },
  ['site-settings'],
  { revalidate: 3600, tags: ['settings'] }
);

/**
 * Update site settings.
 */
export async function updateSiteSettings(updateData) {
  const { data, error } = await supabase
    .from('site_settings')
    .update({
      ...updateData,
      updated_at: new Date().toISOString()
    })
    .eq('id', 1)
    .select()
    .single();

  if (error) {
    console.error('Error updating site settings:', error);
    throw error;
  }
  return data;
}

/* ========================================
   SYSTEM SETTINGS (PAYPAL, etc.)
   ======================================== */

/**
 * Get PayPal configuration from system_settings.
 * Cached for performance.
 */
export const getPaypalConfig = unstable_cache(
  async () => {
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'paypal_config')
      .single();

    if (error) {
      console.error('Error fetching PayPal config:', error);
      return null;
    }
    return data?.setting_value || null;
  },
  ['paypal-config'],
  { revalidate: REVALIDATE_TIME, tags: ['settings'] }
);
