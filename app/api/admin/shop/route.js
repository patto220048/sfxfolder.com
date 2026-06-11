import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { getServerUser } from "@/app/lib/supabase-server";

export const dynamic = 'force-dynamic';

/**
 * Helper to verify user is authenticated and is an admin
 */
async function verifyAdmin() {
  const { user: adminUser } = await getServerUser();
  if (!adminUser) return { error: "Unauthorized", status: 401 };

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", adminUser.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    return { error: "Forbidden", status: 403 };
  }

  return { adminUser };
}

/**
 * POST: Create a new sound pack
 */
export async function POST(req) {
  try {
    const auth = await verifyAdmin();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const { pack, items = [] } = body;

    if (!pack || !pack.name || !pack.slug) {
      return NextResponse.json({ error: "Pack name and slug are required" }, { status: 400 });
    }

    // 1. Insert pack
    const { data: newPack, error: packErr } = await supabaseAdmin
      .from("sound_packs")
      .insert(pack)
      .select("id")
      .single();

    if (packErr) {
      console.error("[Admin Shop POST] DB Insert Pack Error:", packErr);
      if (packErr.code === '23505') {
        return NextResponse.json({ error: "Slug này đã tồn tại, vui lòng dùng slug khác." }, { status: 400 });
      }
      throw packErr;
    }

    const packId = newPack.id;

    // 2. Insert items
    if (items && items.length > 0) {
      const itemsToInsert = items.map((item, idx) => ({
        pack_id: packId,
        resource_id: item.resource_id || null,
        file_name: item.file_name,
        file_format: item.file_format || null,
        file_size: item.file_size || 0,
        storage_path: item.storage_path || null,
        preview_url: item.preview_url || null,
        is_previewable: item.is_previewable || false,
        sort_order: idx,
      }));

      const { error: itemsErr } = await supabaseAdmin
        .from("sound_pack_items")
        .insert(itemsToInsert);

      if (itemsErr) {
        console.error("[Admin Shop POST] DB Insert Items Error:", itemsErr);
        throw itemsErr;
      }
    }

    return NextResponse.json({ success: true, id: packId });
  } catch (err) {
    console.error("[Admin Shop POST] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
