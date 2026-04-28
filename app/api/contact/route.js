import { Resend } from 'resend';
import { NextResponse } from 'next/server';

export async function POST(request) {
  // Initialize Resend inside the handler to prevent build-time errors if API key is missing
  const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');
  try {
    const { name, email, message, _honeypot, turnstileToken } = await request.json();

    // 1. Honeypot check: if this hidden field is filled, it's likely a bot
    if (_honeypot) {
      console.log('Spam detected via honeypot');
      return NextResponse.json({ success: true, message: 'Message sent successfully' });
    }

    // 2. Turnstile Verification
    if (!turnstileToken) {
      return NextResponse.json({ error: 'Security token missing' }, { status: 400 });
    }

    const verifyResponse = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA', // Test Secret Key
          response: turnstileToken,
        }),
      }
    );

    const verifyData = await verifyResponse.json();
    if (!verifyData.success) {
      return NextResponse.json({ error: 'Security verification failed' }, { status: 403 });
    }

    // 3. Validation
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // 4. Send Email
    if (!process.env.RESEND_API_KEY) {
      console.error('Missing RESEND_API_KEY environment variable');
      return NextResponse.json({ error: 'Mail service is not configured' }, { status: 500 });
    }

    const data = await resend.emails.send({
      from: `${name} <contact@sfxfolder.com>`,
      to: ['support@whuusoiast.resend.app'],
      reply_to: email,
      subject: `New Inquiry from ${name} (via SFXFolder)`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="border-bottom: 1px solid #eee; padding-bottom: 10px;">New Contact Inquiry</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <div style="margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 5px;">
            <p><strong>Message:</strong></p>
            <p style="white-space: pre-wrap;">${message}</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Contact API Error:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
