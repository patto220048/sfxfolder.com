import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/app/lib/supabase-server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export async function POST(request) {
  try {
    // 1. Auth required (cookie + Authorization header fallback)
    const supabase = await createServerSupabaseClient();
    let { data: { user } } = await supabase.auth.getUser();

    // Fallback: Authorization header (for plugin environments where cookies are blocked)
    if (!user) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const { data: { user: headerUser }, error: headerError } = await supabase.auth.getUser(token);
        if (!headerError && headerUser) {
          user = headerUser;
          console.log("[ShopAPI] Download authenticated via Authorization header:", user.email);
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { packId } = await request.json();

    if (!packId) {
      return NextResponse.json(
        { error: "packId is required" },
        { status: 400 }
      );
    }

    // 2. Check user has access to this pack
    const { data: hasAccess, error: accessError } = await supabaseAdmin
      .rpc("user_has_pack_access", {
        p_user_id: user.id,
        p_pack_id: packId,
      });

    if (accessError) {
      console.error("[ShopAPI] Access check RPC error:", accessError);
      return NextResponse.json(
        { error: "Failed to verify pack access" },
        { status: 500 }
      );
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: "You do not have access to this pack. Please purchase it first." },
        { status: 403 }
      );
    }

    // 3. Get pack's zip storage path
    const { data: pack, error: packError } = await supabaseAdmin
      .from("sound_packs")
      .select("id, name, zip_storage_path")
      .eq("id", packId)
      .single();

    if (packError || !pack) {
      return NextResponse.json(
        { error: "Pack not found" },
        { status: 404 }
      );
    }

    if (!pack.zip_storage_path) {
      return NextResponse.json(
        { error: "Pack download file is not available yet" },
        { status: 404 }
      );
    }

    // 4. Generate signed URL from Supabase Storage (site-assets bucket)
    const downloadName = `${pack.name || "sound-pack"}.zip`;

    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from("site-assets")
      .createSignedUrl(pack.zip_storage_path, 120, {
        download: downloadName,
      });

    if (signedError || !signedData?.signedUrl) {
      console.error("[ShopAPI] Storage signed URL error:", signedError);
      return NextResponse.json(
        { error: "Failed to generate download link" },
        { status: 500 }
      );
    }

    // 5. CDN rewrite — replace Supabase hostname with custom CDN domain
    const downloadUrl = signedData.signedUrl.replace(
      "riorhpppwzbnjaucatjc.supabase.co",
      "cdn.sfxfolder.com"
    );

    // 6. Log the download (non-blocking)
    try {
      await supabaseAdmin
        .from("pack_download_log")
        .insert({
          user_id: user.id,
          pack_id: packId,
          downloaded_at: new Date().toISOString(),
        });
    } catch (e) {
      console.warn("[ShopAPI] Failed to log pack download:", e);
    }

    return NextResponse.json({
      success: true,
      downloadUrl,
    });
  } catch (error) {
    console.error("[ShopAPI] Unhandled error in POST /api/shop/download:", error);
    return NextResponse.json(
      { error: "Failed to process download" },
      { status: 500 }
    );
  }
}
