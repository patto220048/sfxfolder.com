import { supabase } from './supabase';
import { convertToSlug } from './stringUtils';

/**
 * Upload a file to Supabase Storage
 * @param {File} file - The file to upload
 * @param {string} path - Storage path
 * @param {string} bucket - Storage bucket name (default: "resources")
 * @param {function} onProgress - Progress callback
 * @returns {Promise<string>} Public URL
 */
export async function uploadFile(file, path, bucket = 'resources', onProgress = null) {
  // Note: Supabase JS client doesn't have a built-in progress callback like Firebase.
  // For production, you might want to use XMLHttpRequest or a special library if progress is critical.
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    console.error('Error uploading file:', error);
    throw error;
  }

  // Get the public URL
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return publicUrl;
}

/**
 * Get download URL for a file
 * @param {string} path - Storage path
 * @param {string} bucket - Bucket name
 * @returns {string} Public URL
 */
export async function getFileUrl(path, bucket = 'resources') {
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return publicUrl;
}

/**
 * Delete a file from Supabase Storage
 * @param {string} path - Storage path
 * @param {string} bucket - Bucket name
 */
export async function deleteFile(path, bucket = 'resources') {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
  return true;
}

/**
 * Generate storage path for a resource file
 * @param {string} category - Category slug
 * @param {string} filename - Original filename
 * @returns {string} Storage path
 */
export function generateStoragePath(category, filename) {
  const timestamp = Date.now();
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  const ext = filename.includes(".") ? "." + filename.split(".").pop() : "";
  const safeBase = convertToSlug(nameWithoutExt);
  // Using category name as bucket folder
  return `${category}/${timestamp}-${safeBase}${ext}`;
}
