import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { getServerUser } from "@/app/lib/supabase-server";

export async function POST(req) {
  const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');
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

    const { messageId, replyMessage } = await req.json();

    if (!messageId || !replyMessage) {
      return NextResponse.json({ error: "Message ID and Reply Content are required" }, { status: 400 });
    }

    // 1. Get original message details
    const { data: msg, error: fetchError } = await supabaseAdmin
      .from("contact_messages")
      .select("*")
      .eq("id", messageId)
      .single();

    if (fetchError || !msg) {
      return NextResponse.json({ error: "Original message not found" }, { status: 404 });
    }

    // 2. Send Email via Resend
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: "RESEND_API_KEY is not configured" }, { status: 500 });
    }

    const emailResult = await resend.emails.send({
      from: "SFXFolder Support <support@sfxfolder.com>",
      to: [msg.email],
      subject: `Re: Inquiry from ${msg.name} - SFXFolder Support`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; line-height: 1.6;">
          <h2 style="color: #111; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">SFXFolder Support</h2>
          <p>Hi <strong>${msg.name}</strong>,</p>
          <div style="background: #fff; border-left: 4px solid #facb11; padding: 15px; margin: 20px 0; background-color: #fafafa;">
            <p style="white-space: pre-wrap; margin: 0;">${replyMessage}</p>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="font-size: 12px; color: #777;">
            <strong>Your original message:</strong><br />
            "${msg.message}"
          </p>
        </div>
      `,
    });

    if (emailResult.error) {
      throw new Error(emailResult.error.message || "Failed to send email via Resend");
    }

    // 3. Update status in Supabase
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("contact_messages")
      .update({
        status: "replied",
        reply_message: replyMessage,
        replied_at: new Date().toISOString(),
      })
      .eq("id", messageId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[Admin Support Reply API] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
