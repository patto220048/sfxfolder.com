import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { getServerUser } from "@/app/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * Verify admin authentication
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
 * POST handler to upload cover image to site-assets storage bucket
 */
export async function POST(req) {
  try {
    // 1. Verify admin auth
    const auth = await verifyAdmin();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // 2. Parse request formData
    const formData = await req.formData();
    const file = formData.get("file");
    const slug = formData.get("slug") || "custom";

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No image file provided for upload" }, { status: 400 });
    }

    const safeSlug = slug.replace(/[^\w\-]+/g, "");
    
    // 3. Detect extension and content type
    const contentType = file.type || "image/jpeg";
    let ext = "jpg";
    if (contentType === "image/png") ext = "png";
    if (contentType === "image/webp") ext = "webp";
    if (contentType === "image/gif") ext = "gif";
    
    // Fallback detection from original name
    if (file.name && file.name.includes(".")) {
      const parts = file.name.split(".");
      const parsedExt = parts[parts.length - 1].toLowerCase();
      if (["jpg", "jpeg", "png", "webp", "gif"].includes(parsedExt)) {
        ext = parsedExt === "jpeg" ? "jpg" : parsedExt;
      }
    }

    const filename = `${safeSlug}-${Date.now()}.${ext}`;
    const storagePath = `blog-covers/${filename}`;

    console.log(`[Upload Image] Uploading local image ${file.name} to site-assets storage: ${storagePath}...`);

    // 4. Convert file data to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // 5. Upload Buffer directly to Supabase storage (site-assets bucket)
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("site-assets")
      .upload(storagePath, imageBuffer, {
        contentType: contentType,
        cacheControl: "31536000",
        upsert: true,
      });

    if (uploadError) {
      console.error("[Upload Image] Supabase Storage upload error:", uploadError);
      throw uploadError;
    }

    // 6. Get CDN public URL
    const { data: urlData } = supabaseAdmin.storage
      .from("site-assets")
      .getPublicUrl(storagePath);

    const publicUrl = urlData?.publicUrl;
    console.log(`[Upload Image] Upload completed. CDN public URL: ${publicUrl}`);

    return NextResponse.json({
      success: true,
      cover_image: publicUrl,
    });
  } catch (err) {
    console.error("[Upload Image] Core Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
