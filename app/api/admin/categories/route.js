import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { getServerUser } from "@/app/lib/supabase-server";
import { getAdminCategoriesWithCounts } from "@/app/lib/api";

export const dynamic = 'force-dynamic';

/**
 * Get all categories with counts (uncached for Admin)
 */
export async function GET() {
  try {
    const { user: adminUser } = await getServerUser();
    if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify admin role
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", adminUser.id)
      .single();

    if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const categories = await getAdminCategoriesWithCounts();
    return NextResponse.json(categories);
  } catch (err) {
    console.error("[Admin Category GET] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Handle recursive deletion of Category + Folders + Resources + Storage Files
 */
export async function DELETE(req) {
  try {
    const { user: adminUser } = await getServerUser();
    if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify admin role
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", adminUser.id)
      .single();

    if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { slug } = await req.json();
    if (!slug) return NextResponse.json({ error: "Slug is required" }, { status: 400 });

    console.log(`[Admin Category DELETE] Starting cascading delete for slug: ${slug}`);

    // 1. Get all resources in this category to clean up Storage
    const { data: resources, error: resFetchError } = await supabaseAdmin
      .from("resources")
      .select("id, storage_path")
      .eq("category_id", slug);

    if (resFetchError) throw resFetchError;

    // 2. Cleanup Storage files
    const storagePaths = (resources || [])
      .map(r => r.storage_path)
      .filter(p => !!p);

    if (storagePaths.length > 0) {
      console.log(`[Admin Category DELETE] Cleaning up ${storagePaths.length} files from storage`);
      const { error: storageError } = await supabaseAdmin.storage
        .from("resources")
        .remove(storagePaths);
      
      if (storageError) {
        console.error("[Admin Category DELETE] Storage cleanup error:", storageError);
        // We continue anyway to try and delete the records, or we could stop.
        // Usually better to stop if storage removal is critical, but here we want to clear the DB blocker.
      }
    }

    // 3. Delete Resources (this clears some FK constraints if any)
    const { error: resDeleteError } = await supabaseAdmin
      .from("resources")
      .delete()
      .eq("category_id", slug);

    if (resDeleteError) throw resDeleteError;

    // 4. Delete Folders (this was causing the fk_folders_category error)
    const { error: folderDeleteError } = await supabaseAdmin
      .from("folders")
      .delete()
      .eq("category_id", slug);

    if (folderDeleteError) throw folderDeleteError;

    // 5. Finally delete the category itself
    const { error: catDeleteError } = await supabaseAdmin
      .from("categories")
      .delete()
      .eq("slug", slug);

    if (catDeleteError) throw catDeleteError;

    // 6. Invalidate frontend cache
    revalidateTag('resources', 'max');
    revalidateTag('categories', 'max');

    return NextResponse.json({ success: true, deletedResources: resources?.length || 0 });

  } catch (err) {
    console.error("[Admin Category DELETE] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
