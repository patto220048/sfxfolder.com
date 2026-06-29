import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { getServerUser } from "@/app/lib/supabase-server";

export async function POST(req) {
  try {
    const { user: adminUser } = await getServerUser();
    if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", adminUser.id)
      .single();

    if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { messageId, draftMessage, isManualDraft, recipientEmail, subject } = await req.json();

    if (isManualDraft) {
      // Save a new manual draft
      const { data, error } = await supabaseAdmin
        .from("contact_messages")
        .insert({
          name: "Khách hàng (Bản nháp)",
          email: recipientEmail || "chua_nhap_email@example.com",
          message: `[Bản nháp] ${subject || "Không có tiêu đề"}`,
          status: "draft",
          draft_reply: draftMessage,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    } else {
      // Save draft reply for existing message
      if (!messageId) return NextResponse.json({ error: "messageId is required" }, { status: 400 });

      const { data, error } = await supabaseAdmin
        .from("contact_messages")
        .update({ draft_reply: draftMessage })
        .eq("id", messageId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }
  } catch (err) {
    console.error("[Admin Support Draft API] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
