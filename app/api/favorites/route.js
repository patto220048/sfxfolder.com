import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/app/lib/supabase-server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

async function getAuthenticatedUser(request) {
  const supabase = await createServerSupabaseClient();
  let {
    data: { user },
  } = await supabase.auth.getUser();

  // Fallback: Check Authorization header (required for some plugin environments where cookies are blocked)
  if (!user) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const { data: { user: headerUser }, error: headerError } = await supabase.auth.getUser(token);
      if (!headerError && headerUser) {
        user = headerUser;
        console.log("[FavoritesAPI] Authenticated via Authorization header:", user.email);
      }
    }
  }
  return user;
}

export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("favorites")
      .select(`
        resource_id,
        resources (
          category_id
        )
      `)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("API GET /api/favorites error:", error);
    return NextResponse.json({ error: "Failed to fetch favorites" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { resourceId } = await request.json();
    if (!resourceId) {
      return NextResponse.json({ error: "resourceId is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("favorites")
      .insert({
        user_id: user.id,
        resource_id: resourceId,
      })
      .select()
      .single();

    if (error) {
      // Check for unique key constraint error
      if (error.code === "23505") {
        return NextResponse.json({ success: true, message: "Already in favorites" });
      }
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("API POST /api/favorites error:", error);
    return NextResponse.json({ error: "Failed to add to favorites" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { resourceId } = await request.json();
    if (!resourceId) {
      return NextResponse.json({ error: "resourceId is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("resource_id", resourceId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API DELETE /api/favorites error:", error);
    return NextResponse.json({ error: "Failed to remove from favorites" }, { status: 500 });
  }
}
