"use server";

import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Revalidates the cached data for resources.
 * This should be called after any Add, Update, or Delete operation in the Admin panel.
 */
export async function revalidateResourceData() {
  try {
    // 1. Revalidate the homepage (which shows category counts)
    revalidatePath("/");
    
    // 2. Revalidate all category pages using the 'resources' tag
    // This targets the unstable_cache in app/[category]/page.js
    revalidateTag("resources");
    
    // 3. Specifically revalidate the category path if needed (optional since tag covers it)
    // we use 'layout' type to be safe
    revalidatePath("/[category]", "page");
    
    console.log("Successfully triggered on-demand revalidation for resources.");
    return { success: true };
  } catch (error) {
    console.error("Failed to revalidate:", error);
    return { success: false, error: error.message };
  }
}

export async function revalidateCategoryData() {
  try {
    revalidatePath("/");
    revalidateTag("categories");
    revalidatePath("/[category]", "page");
    console.log("Successfully triggered on-demand revalidation for categories.");
    return { success: true };
  } catch (error) {
    console.error("Failed to revalidate categories:", error);
    return { success: false, error: error.message };
  }
}
