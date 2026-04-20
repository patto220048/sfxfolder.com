import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { getServerUser } from "@/app/lib/supabase-server";

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const { user: adminUser } = await getServerUser();
    if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify admin role
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", adminUser.id)
      .single();

    if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { full_name, role } = await req.json();

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ full_name, role })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("[Admin User PATCH] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    const { user: adminUser } = await getServerUser();
    if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify admin role
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", adminUser.id)
      .single();

    if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    
    // Prevent self-deletion
    if (adminUser.id === id) {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
    }

    // Delete from Auth (Admin API deleteUser)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw error;

    // Explicitly delete from profiles if not already cascaded
    await supabaseAdmin.from("profiles").delete().eq("id", id);

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("[Admin User DELETE] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
