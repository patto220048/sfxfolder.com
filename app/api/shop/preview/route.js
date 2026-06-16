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
      .select("id, pack_id, preview_url, is_previewable, resource_id")
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

    // 3. Resolve the preview URL with fallback to the library resource
    let finalPreviewUrl = item.preview_url;
    let isLibraryResource = !!item.resource_id;

    if (!finalPreviewUrl && item.resource_id) {
      try {
        const { data: resData } = await supabaseAdmin
          .from("resources")
          .select("preview_url, storage_path")
          .eq("id", item.resource_id)
          .single();

        if (resData) {
          finalPreviewUrl = resData.preview_url || resData.storage_path;
          isLibraryResource = true;
        }
      } catch (err) {
        console.warn("[ShopAPI] Failed to fetch resource preview fallback:", err);
      }
    }

    if (!finalPreviewUrl) {
      return NextResponse.json(
        { error: "No preview file available" },
        { status: 404 }
      );
    }

    // If preview_url is already a full URL, return it directly with CDN rewrite
    if (finalPreviewUrl.startsWith("http://") || finalPreviewUrl.startsWith("https://")) {
      const cdnUrl = finalPreviewUrl.replace(
        "riorhpppwzbnjaucatjc.supabase.co",
        "cdn.sfxfolder.com"
      );
      return NextResponse.json(
        { previewUrl: cdnUrl },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // Determine the correct storage bucket dynamically:
    // library items go to 'resources', custom direct uploads go to 'site-assets'
    const bucket = isLibraryResource ? "resources" : "site-assets";
    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(finalPreviewUrl, 300); // 5 minutes

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
