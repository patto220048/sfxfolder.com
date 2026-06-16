import { NextResponse } from "next/server";
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
 * PUT: Update an existing coupon
 */
export async function PUT(req, { params: paramsPromise }) {
  try {
    const params = await paramsPromise;
    const { id } = params;
    const auth = await verifyAdmin();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const payload = await req.json();

    const { data, error } = await supabaseAdmin
      .from("coupons")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[Admin Coupons PUT] Error:", error);
      if (error.code === '23505') {
        return NextResponse.json({ error: "Mã giảm giá này đã tồn tại." }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[Admin Coupons PUT] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE: Delete a coupon
 */
export async function DELETE(req, { params: paramsPromise }) {
  try {
    const params = await paramsPromise;
    const { id } = params;
    const auth = await verifyAdmin();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { error } = await supabaseAdmin
      .from("coupons")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Admin Coupons DELETE] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
