import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/app/lib/supabase-server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

// GET: Fetch reviews for a specific sound pack
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Pack ID is required" }, { status: 400 });
    }

    const { data: reviews, error } = await supabaseAdmin
      .from("sound_pack_reviews")
      .select(`
        id,
        user_id,
        rating,
        comment,
        created_at,
        updated_at,
        profiles:user_id (
          full_name,
          avatar_url,
          email
        )
      `)
      .eq("pack_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[ShopAPI] Failed to fetch reviews:", error);
      return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
    }

    // Format reviewer display name and email fallback
    const formattedReviews = reviews.map((review) => {
      const profile = review.profiles || {};
      let displayName = profile.full_name || "";
      if (!displayName && profile.email) {
        // Obfuscate email as fallback (e.g. user***@domain.com)
        const parts = profile.email.split("@");
        if (parts[0].length > 3) {
          displayName = parts[0].substring(0, 3) + "***@" + parts[1];
        } else {
          displayName = "***@" + parts[1];
        }
      }
      if (!displayName) {
        displayName = "Anonymous User";
      }

      return {
        id: review.id,
        userId: review.user_id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.created_at,
        updatedAt: review.updated_at,
        reviewer: {
          name: displayName,
          avatarUrl: profile.avatar_url || null,
        },
      };
    });

    return NextResponse.json({ reviews: formattedReviews });
  } catch (error) {
    console.error("[ShopAPI] Unhandled error in GET reviews:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST: Add or update a review
export async function POST(request, { params }) {
  try {
    const { id } = await params;

    // 1. Authenticate user
    const supabase = await createServerSupabaseClient();
    let { data: { user } } = await supabase.auth.getUser();

    // Fallback: Authorization Bearer header
    if (!user) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const { data: { user: headerUser }, error: headerError } = await supabase.auth.getUser(token);
        if (!headerError && headerUser) {
          user = headerUser;
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rating, comment } = await request.json();

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
    }

    // 2. Verify user has access to the pack
    const { data: hasAccess, error: accessError } = await supabaseAdmin
      .rpc("user_has_pack_access", {
        p_user_id: user.id,
        p_pack_id: id,
      });

    if (accessError) {
      console.error("[ShopAPI] Access verification RPC error:", accessError);
      return NextResponse.json({ error: "Verification failed" }, { status: 500 });
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: "You must purchase or unlock this pack to write a review" },
        { status: 403 }
      );
    }

    // 3. Upsert the review
    const { data: review, error: upsertError } = await supabaseAdmin
      .from("sound_pack_reviews")
      .upsert(
        {
          user_id: user.id,
          pack_id: id,
          rating,
          comment: comment || "",
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,pack_id",
        }
      )
      .select()
      .single();

    if (upsertError) {
      console.error("[ShopAPI] Failed to save review:", upsertError);
      return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
    }

    return NextResponse.json({ success: true, review });
  } catch (error) {
    console.error("[ShopAPI] Unhandled error in POST review:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE: Delete a review (by owner or admin)
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    // 1. Authenticate user
    const supabase = await createServerSupabaseClient();
    let { data: { user } } = await supabase.auth.getUser();

    // Fallback: Authorization Bearer header
    if (!user) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const { data: { user: headerUser }, error: headerError } = await supabase.auth.getUser(token);
        if (!headerError && headerUser) {
          user = headerUser;
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse target user ID if provided (admin deleting a user's review)
    let targetUserId = user.id;
    try {
      const body = await request.json();
      if (body?.userId) {
        targetUserId = body.userId;
      }
    } catch (e) {
      // Body might be empty, ignore
    }

    // 2. Authorization check
    if (targetUserId !== user.id) {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || profile?.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // 3. Delete review
    const { error: deleteError } = await supabaseAdmin
      .from("sound_pack_reviews")
      .delete()
      .eq("pack_id", id)
      .eq("user_id", targetUserId);

    if (deleteError) {
      console.error("[ShopAPI] Failed to delete review:", deleteError);
      return NextResponse.json({ error: "Failed to delete review" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ShopAPI] Unhandled error in DELETE review:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
