import { supabase } from './supabase';

/* ========================================
   RESOURCES
   ======================================== */

/**
 * Helper to map DB resource to Frontend resource
 */
function mapResource(res) {
  if (!res) return null;
  return {
    ...res,
    categoryId: res.category_id || res.category_slug, // Handle both old and new schema
    folderId: res.folder_id,
    fileFormat: res.file_format,
    fileSize: res.file_size,
    fileName: res.file_name,
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
 * Get resources with optional category and folder filtering.
 * Implements basic limits and ordering.
 */
export async function getResources({ categorySlug, folderId, limit = 20, offset = 0 } = {}) {
  let query = supabase
    .from('resources')
    .select('id, name, description, slug, category_id, folder_id, file_format, file_size, file_name, file_type, tags, download_url, preview_url, thumbnail_url, storage_path, download_count, is_published, created_at, updated_at, categories!inner(slug, name), folders(name)')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (categorySlug) {
    query = query.eq('categories.slug', categorySlug);
  }
  if (folderId) {
    query = query.eq('folder_id', folderId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching resources:', error);
    return [];
  }
  return data.map(mapResource);
}

/**
 * Find resources using PostgreSQL Full-Text Search.
 */
export async function searchResources(searchQuery) {
  const { data, error } = await supabase
    .from('resources')
    .select('id, name, description, slug, category_id, folder_id, file_format, file_size, file_name, file_type, tags, download_url, preview_url, thumbnail_url, storage_path, download_count, is_published, created_at, updated_at, categories(slug, name)')
    .eq('is_published', true)
    .textSearch('fts', searchQuery, {
      type: 'websearch',
      config: 'english'
    })
    .limit(20);

  if (error) {
    console.error('Error searching resources:', error);
    return [];
  }
  return data.map(mapResource);
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
  const { error } = await supabase
    .from('resources')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting resource:', error);
    throw error;
  }
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
    const { data: current } = await supabase.from('resources').select('download_count').eq('id', id).single();
    return supabase.from('resources').update({ download_count: (current?.download_count || 0) + 1 }).eq('id', id);
  }
  return data;
}

/* ========================================
   CATEGORIES
   ======================================== */

/**
 * Get all categories with resource counts using SQL Joins.
 * This is much more efficient than the old Firebase way.
 */
export async function getCategoriesWithCounts() {
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

export async function getCategoryBySlug(slug) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error('Error fetching category by slug:', error);
    return null;
  }
  return data;
}

export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('order', { ascending: true });

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
  return data;
}

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
      color: categoryData.color || '#00F0FF',
      formats: categoryData.formats || [],
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
 * Delete a category.
 */
export async function deleteCategory(id) {
  // First, check if there are resources assigned to this category
  const { data: category } = await supabase.from('categories').select('slug').eq('id', id).single();
  
  if (category) {
    const { count, error: countError } = await supabase
      .from('resources')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', category.slug);

    if (count > 0) {
      throw new Error(`Cannot delete category "${category.slug}" because it has ${count} resources assigned to it.`);
    }
  }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
  return true;
}

/* ========================================
   FOLDERS
   ======================================== */

/**
 * Get folders for a category, optionally filtered by parent.
 */
export async function getFolders(categorySlug, parentId = null) {
  let query = supabase
    .from('folders')
    .select('*, category:categories!inner(slug)')
    .eq('categories.slug', categorySlug)
    .order('order', { ascending: true });

  if (parentId) {
    query = query.eq('parent_id', parentId);
  } else {
    query = query.is('parent_id', null);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching folders:', error);
    return [];
  }
  return (data || []).map(mapFolder);
}

/* ========================================
   TAGS
   ======================================== */

export async function getTags() {
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
 * Get all folders (including unpublished/admin)
 */
export async function getAllAdminFolders() {
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

  // Check if all updates are targeting the same folder_id (common case: Move)
  const first = updates[0];
  const allSameFolder = updates.every(u => u.folder_id === first.folder_id);

  if (allSameFolder) {
    const ids = updates.map(u => u.id);
    const { data, error } = await supabase
      .from('resources')
      .update({
        folder_id: first.folder_id,
        updated_at: new Date().toISOString()
      })
      .in('id', ids)
      .select();

    if (error) {
      console.error('Error in bulk update (allSameFolder):', error);
      throw error;
    }
    return data;
  }

  // Fallback for heterogeneous updates: Run in parallel (Supabase doesn't support bulk heterogeneous updates easily in one call)
  const promises = updates.map(u => {
    const dbEntry = mapToDB(u);
    return supabase
      .from('resources')
      .update({
        ...dbEntry,
        updated_at: new Date().toISOString()
      })
      .eq('id', u.id);
  });

  const results = await Promise.all(promises);
  const errors = results.filter(r => r.error);
  
  if (errors.length > 0) {
    console.error('Error in bulk update (heterogeneous):', errors[0].error);
    throw errors[0].error;
  }
  
  return results.map(r => r.data);
}

/**
 * Delete multiple resources.
 */
export async function bulkDeleteResources(ids) {
  const { error } = await supabase
    .from('resources')
    .delete()
    .in('id', ids);

  if (error) {
    console.error('Error in bulk delete:', error);
    throw error;
  }
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
