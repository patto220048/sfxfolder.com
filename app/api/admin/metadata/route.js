import { NextResponse } from "next/server";
import { 
  getAdminCategoriesWithCounts, 
  getAdminFolders, 
  getAdminTags 
} from "@/app/lib/api";
import { getServerUser } from "@/app/lib/supabase-server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export const dynamic = 'force-dynamic';

/**
 * Global Admin Metadata Fetcher (Uncached)
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

    // Fetch all fresh meta in parallel
    const [folders, categories, tags] = await Promise.all([
      getAdminFolders(),
      getAdminCategoriesWithCounts(),
      getAdminTags()
    ]);

    return NextResponse.json({ folders, categories, tags });
  } catch (err) {
    console.error("[Admin Metadata GET] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
