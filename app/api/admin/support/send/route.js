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

    const { recipientName, recipientEmail, subject, message } = await req.json();

    if (!recipientEmail || !subject || !message) {
      return NextResponse.json({ error: "Email, Subject, and Message are required" }, { status: 400 });
    }

    // 1. Send Email via Resend
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: "RESEND_API_KEY is not configured" }, { status: 500 });
    }

    const emailResult = await resend.emails.send({
      from: "SFXFolder Support <support@sfxfolder.com>",
      to: [recipientEmail],
      subject: subject,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; line-height: 1.6;">
          <h2 style="color: #111; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">SFXFolder Support</h2>
          <p>Hi <strong>${recipientName || recipientEmail}</strong>,</p>
          <div style="background: #fff; border-left: 4px solid #facb11; padding: 15px; margin: 20px 0; background-color: #fafafa;">
            <p style="white-space: pre-wrap; margin: 0;">${message}</p>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="font-size: 12px; color: #777;">SFXFolder Team — support@sfxfolder.com</p>
        </div>
      `,
    });

    if (emailResult.error) {
      throw new Error(emailResult.error.message || "Failed to send email via Resend");
    }

    // 2. Log into Supabase contact_messages table
    const { data: inserted, error: dbError } = await supabaseAdmin
      .from("contact_messages")
      .insert({
        name: recipientName || "Khách hàng",
        email: recipientEmail,
        message: `[Email khởi tạo thủ công] ${subject}`,
        status: "replied",
        reply_message: message,
        replied_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) console.error("Error logging manual email to DB:", dbError);

    return NextResponse.json({ success: true, data: inserted });
  } catch (err) {
    console.error("[Admin Support Send Manual API] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
