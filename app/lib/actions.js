"use server";

import { revalidateTag } from "next/cache";

/**
 * Revalidate the site settings cache.
 */
export async function revalidateSettings() {
  revalidateTag('settings', 'max');
}

/**
 * Revalidate categories cache.
 */
export async function revalidateCategoryData() {
  revalidateTag('categories', 'max');
}

// Alias for compatibility
export async function revalidateCategories() {
  return revalidateCategoryData();
}

/**
 * Revalidate resource list cache.
 * Note: This also revalidates folders as they are often displayed together.
 */
export async function revalidateResourceData() {
  revalidateTag('resources', 'max');
}

/**
 * Revalidate tags cache.
 */
export async function revalidateTagData() {
  revalidateTag('tags', 'max');
}

/**
 * Revalidate folders cache.
 */
export async function revalidateFolderData() {
  revalidateTag('folders', 'max');
}

/**
 * Comprehensive revalidation for tag-related changes.
 * When a tag is renamed or deleted, it affects both tags list and resources.
 */
export async function revalidateTagChanges() {
  revalidateTag('tags', 'max');
  revalidateTag('resources', 'max');
}
