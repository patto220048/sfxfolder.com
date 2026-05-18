import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { supabaseAdmin, ensureSupabaseImage } from "@/app/lib/supabase-admin";
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
 * GET single blog post details
 */
export async function GET(req, { params }) {
  try {
    const auth = await verifyAdmin();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Post ID is required" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("blog_posts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("[Admin Blog ID GET] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PUT update existing blog post
 */
export async function PUT(req, { params }) {
  try {
    const auth = await verifyAdmin();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Post ID is required" }, { status: 400 });

    const body = await req.json();
    let { title, slug, content, summary, cover_image, status, meta_title, meta_description } = body;

    if (!title || !slug || !content) {
      return NextResponse.json({ error: "Title, slug, and content are required" }, { status: 400 });
    }

    // Đảm bảo ảnh bìa được lưu trữ trên CDN riêng Supabase (site-assets)
    try {
      cover_image = await ensureSupabaseImage(cover_image, slug);
    } catch (imgErr) {
      console.error("[Admin Blog ID PUT] Failed to store cover image on Supabase:", imgErr);
    }

    const { data, error } = await supabaseAdmin
      .from("blog_posts")
      .update({
        title,
        slug,
        content,
        summary: summary || null,
        cover_image: cover_image || null,
        status: status || 'draft',
        meta_title: meta_title || null,
        meta_description: meta_description || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[Admin Blog ID PUT] DB Update Error:", error);
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: "Slug này đã tồn tại, vui lòng dùng slug khác." }, { status: 400 });
      }
      throw error;
    }

    // Invalidate blog caches
    revalidateTag('blog');

    return NextResponse.json(data);
  } catch (err) {
    console.error("[Admin Blog ID PUT] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE existing blog post
 */
export async function DELETE(req, { params }) {
  try {
    const auth = await verifyAdmin();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Post ID is required" }, { status: 400 });

    // Fetch the post first to see if there is an image to delete from storage
    const { data: post, error: fetchError } = await supabaseAdmin
      .from("blog_posts")
      .select("cover_image")
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;

    // Delete post record
    const { error: deleteError } = await supabaseAdmin
      .from("blog_posts")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    // Optional: cleanup cover image if it is in our Supabase storage
    if (post?.cover_image && post.cover_image.includes("blog-covers/")) {
      try {
        const storagePath = post.cover_image.split("/blog-covers/")[1];
        if (storagePath) {
          const fullPath = `blog-covers/${storagePath}`;
          const bucket = post.cover_image.includes("site-assets") ? "site-assets" : "resources";
          await supabaseAdmin.storage
            .from(bucket)
            .remove([fullPath]);
          console.log(`[Admin Blog DELETE] Cleaned up storage image: ${fullPath} from bucket: ${bucket}`);
        }
      } catch (storageErr) {
        console.error("[Admin Blog DELETE] Storage file cleanup error (ignored):", storageErr);
      }
    }

    // Invalidate blog caches
    revalidateTag('blog');

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Admin Blog ID DELETE] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
