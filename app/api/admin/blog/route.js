import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
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
 * GET all blog posts (uncached, for Admin list)
 */
export async function GET() {
  try {
    const auth = await verifyAdmin();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { data, error } = await supabaseAdmin
      .from("blog_posts")
      .select("id, title, slug, summary, cover_image, status, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("[Admin Blog GET] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST a new blog post
 */
export async function POST(req) {
  try {
    const auth = await verifyAdmin();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const { title, slug, content, summary, cover_image, status, meta_title, meta_description } = body;

    if (!title || !slug || !content) {
      return NextResponse.json({ error: "Title, slug, and content are required" }, { status: 400 });
    }

    // Insert blog post
    const { data, error } = await supabaseAdmin
      .from("blog_posts")
      .insert([{
        title,
        slug,
        content,
        summary: summary || null,
        cover_image: cover_image || null,
        status: status || 'draft',
        meta_title: meta_title || null,
        meta_description: meta_description || null
      }])
      .select()
      .single();

    if (error) {
      console.error("[Admin Blog POST] DB Insert Error:", error);
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: "Slug này đã tồn tại, vui lòng dùng slug khác." }, { status: 400 });
      }
      throw error;
    }

    // Invalidate blog caches
    revalidateTag('blog');

    return NextResponse.json(data);
  } catch (err) {
    console.error("[Admin Blog POST] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
