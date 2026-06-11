import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");

    if (!itemId) {
      return NextResponse.json(
        { error: "itemId is required" },
        { status: 400 }
      );
    }

    // 1. Get the pack item
    const { data: item, error: itemError } = await supabaseAdmin
      .from("sound_pack_items")
      .select("id, pack_id, preview_url, is_previewable")
      .eq("id", itemId)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    if (!item.is_previewable) {
      return NextResponse.json(
        { error: "Preview is not available for this item" },
        { status: 403 }
      );
    }

    // 2. Verify parent pack is published
    const { data: pack, error: packError } = await supabaseAdmin
      .from("sound_packs")
      .select("id, status")
      .eq("id", item.pack_id)
      .single();

    if (packError || !pack || pack.status !== "published") {
      return NextResponse.json(
        { error: "Pack is not available" },
        { status: 404 }
      );
    }

    // 3. Generate signed URL for the preview
    if (!item.preview_url) {
      return NextResponse.json(
        { error: "No preview file available" },
        { status: 404 }
      );
    }

    // Determine the correct storage bucket based on the preview_url path
    // Preview files are typically stored in the resources bucket or site-assets
    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from("resources")
      .createSignedUrl(item.preview_url, 300); // 5 minutes

    if (signedError || !signedData?.signedUrl) {
      console.error("[ShopAPI] Preview signed URL error:", signedError);
      return NextResponse.json(
        { error: "Failed to generate preview URL" },
        { status: 500 }
      );
    }

    // CDN rewrite
    const previewUrl = signedData.signedUrl.replace(
      "riorhpppwzbnjaucatjc.supabase.co",
      "cdn.sfxfolder.com"
    );

    return NextResponse.json(
      { previewUrl },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("[ShopAPI] Unhandled error in GET /api/shop/preview:", error);
    return NextResponse.json(
      { error: "Failed to generate preview" },
      { status: 500 }
    );
  }
}
