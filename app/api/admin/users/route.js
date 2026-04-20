import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { getServerUser } from "@/app/lib/supabase-server";

export async function GET(req) {
  try {
    const { user: adminUser } = await getServerUser();
    if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify admin role
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", adminUser.id)
      .single();

    if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "0");
    const limit = parseInt(searchParams.get("limit") || "25");
    const search = searchParams.get("q") || "";
    const filter = searchParams.get("filter") || "all";

    const offset = page * limit;

    let query = supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, role, subscription_status, subscription_expires_at, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
    }

    if (filter !== "all") {
      if (filter === "premium") {
        query = query.or('role.eq.premium,subscription_status.eq.active');
      } else {
        query = query.eq("role", filter);
      }
    }

    const { data, count, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      data: data || [],
      count: count || 0,
      hasMore: (offset + (data?.length || 0)) < (count || 0)
    });

  } catch (err) {
    console.error("[Admin Users API GET] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { user: adminUser } = await getServerUser();
    if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify admin role
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", adminUser.id)
      .single();

    if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { email, password, full_name, role } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    // 1. Create User in Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (error) throw error;

    // 2. Update Profile (role and full_name)
    // We use upsert in case the trigger didn't fire fast enough
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: data.user.id,
        email: email,
        full_name: full_name,
        role: role || "user",
      });

    if (profileError) throw profileError;

    return NextResponse.json({ success: true, user: data.user });

  } catch (err) {
    console.error("[Admin Users API POST] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
