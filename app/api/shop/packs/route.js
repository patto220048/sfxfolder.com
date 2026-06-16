import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const sort = searchParams.get("sort") || "popular";
    const search = searchParams.get("search");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build the query for published packs
    let query = supabaseAdmin
      .from("sound_packs")
      .select(
        "id, name, slug, description, short_description, price, original_price, category_id, tags, cover_image, item_count, total_size, purchase_count, created_at, updated_at",
        { count: "exact" }
      )
      .eq("status", "published");

    // Filter by category
    if (category) {
      query = query.eq("category_id", category);
    }

    // Search by name or description
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,description.ilike.%${search}%`
      );
    }

    // Sort
    switch (sort) {
      case "newest":
        query = query.order("created_at", { ascending: false });
        break;
      case "price_asc":
        query = query.order("price", { ascending: true });
        break;
      case "price_desc":
        query = query.order("price", { ascending: false });
        break;
      case "popular":
      default:
        query = query.order("purchase_count", { ascending: false, nullsFirst: false });
        break;
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: packs, error, count } = await query;

    if (error) {
      console.error("[ShopAPI] Error fetching packs:", error);
      return NextResponse.json(
        { error: "Failed to fetch packs" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      packs: packs || [],
      total: count || 0,
    });
  } catch (error) {
    console.error("[ShopAPI] Unhandled error in GET /api/shop/packs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
