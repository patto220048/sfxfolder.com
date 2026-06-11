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
 * PUT: Update an existing sound pack
 */
export async function PUT(req, { params: paramsPromise }) {
  try {
    const params = await paramsPromise;
    const { id } = params;
    const auth = await verifyAdmin();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const { pack, items = [] } = body;

    if (!pack || !pack.name || !pack.slug) {
      return NextResponse.json({ error: "Pack name and slug are required" }, { status: 400 });
    }

    // 1. Update pack
    const { error: packErr } = await supabaseAdmin
      .from("sound_packs")
      .update(pack)
      .eq("id", id);

    if (packErr) {
      console.error("[Admin Shop PUT] DB Update Pack Error:", packErr);
      if (packErr.code === '23505') {
        return NextResponse.json({ error: "Slug này đã tồn tại, vui lòng dùng slug khác." }, { status: 400 });
      }
      throw packErr;
    }

    // 2. Sync items
    const { data: dbItems, error: fetchErr } = await supabaseAdmin
      .from("sound_pack_items")
      .select("id, resource_id")
      .eq("pack_id", id);

    if (fetchErr) throw fetchErr;

    const dbResourceIds = dbItems ? dbItems.map((di) => di.resource_id).filter(Boolean) : [];
    const localResourceIds = items.map((li) => li.resource_id).filter(Boolean);

    // 2a. Delete items that were removed
    const toDelete = dbItems?.filter((di) => di.resource_id && !localResourceIds.includes(di.resource_id)) || [];
    if (toDelete.length > 0) {
      const { error: deleteErr } = await supabaseAdmin
        .from("sound_pack_items")
        .delete()
        .in("id", toDelete.map((td) => td.id));

      if (deleteErr) throw deleteErr;
    }

    // 2b. Map items for inserts (no id) vs updates (has id)
    const itemsToUpsert = items.map((item, idx) => ({
      id: item.id || undefined,
      pack_id: id,
      resource_id: item.resource_id || null,
      file_name: item.file_name,
      file_format: item.file_format || null,
      file_size: item.file_size || 0,
      storage_path: item.storage_path || null,
      preview_url: item.preview_url || null,
      is_previewable: item.is_previewable || false,
      sort_order: idx,
    }));

    const inserts = itemsToUpsert.filter(item => !item.id);
    const updates = itemsToUpsert.filter(item => item.id);

    if (inserts.length > 0) {
      inserts.forEach(item => delete item.id);
      const { error: insertErr } = await supabaseAdmin
        .from("sound_pack_items")
        .insert(inserts);
      if (insertErr) throw insertErr;
    }

    if (updates.length > 0) {
      const { error: updateErr } = await supabaseAdmin
        .from("sound_pack_items")
        .upsert(updates);
      if (updateErr) throw updateErr;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Admin Shop PUT] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE: Delete a sound pack
 */
export async function DELETE(req, { params: paramsPromise }) {
  try {
    const params = await paramsPromise;
    const { id } = params;
    const auth = await verifyAdmin();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { error: deleteErr } = await supabaseAdmin
      .from("sound_packs")
      .delete()
      .eq("id", id);

    if (deleteErr) throw deleteErr;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Admin Shop DELETE] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
