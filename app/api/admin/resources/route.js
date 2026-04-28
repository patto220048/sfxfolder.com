import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { getServerUser } from "@/app/lib/supabase-server";
import { mapResource } from "@/app/lib/api";

export const dynamic = 'force-dynamic';

export async function GET(req) {
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

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "0");
    const limit = parseInt(searchParams.get("limit") || "25");
    const search = searchParams.get("q") || "";
    const folderId = searchParams.get("folder") || "";

    const offset = page * limit;

    let query = supabaseAdmin
      .from("resources")
      .select(`
        id, name, slug, category_id, folder_id, file_format, file_size, 
        tags, download_count, preview_url, thumbnail_url, download_url, 
        is_premium, created_at, is_published,
        categories ( slug, name ),
        folders ( name )
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,tags.cs.{${search}}`);
    }

    if (folderId) {
      if (folderId.startsWith('cat-')) {
        query = query.eq('category_id', folderId.replace('cat-', ''));
      } else {
        query = query.eq('folder_id', folderId);
      }
    }

    const { data, count, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      data: (data || []).map(mapResource),
      count: count || 0,
      hasMore: (offset + (data?.length || 0)) < (count || 0)
    });

  } catch (err) {
    console.error("[Admin Resources API] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

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

    const { ids } = await req.json();
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    // 1. Fetch storage paths for cleanup
    const { data: items } = await supabaseAdmin
      .from("resources")
      .select("storage_path")
      .in("id", ids);

    const paths = (items || [])
      .map(i => i.storage_path)
      .filter(p => !!p);

    if (paths.length > 0) {
      // 2. Remove from storage
      const { error: storageError } = await supabaseAdmin.storage
        .from("resources")
        .remove(paths);
      
      if (storageError) {
        console.error("[Bulk Delete] Storage cleanup error:", storageError);
      }
    }

    // 3. Delete from DB
    const { error: dbError } = await supabaseAdmin
      .from("resources")
      .delete()
      .in("id", ids);

    if (dbError) throw dbError;

    // 4. Invalidate frontend cache
    revalidateTag('resources', 'max');

    return NextResponse.json({ success: true, count: ids.length });

  } catch (err) {
    console.error("[Admin Resources DELETE] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
