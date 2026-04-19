import { NextResponse } from "next/server";
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
