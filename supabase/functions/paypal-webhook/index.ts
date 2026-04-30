import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getPayPalAccessToken(clientId: string, secret: string, mode: string) {
  const auth = btoa(`${clientId}:${secret}`)
  const url = mode === 'live'
    ? 'https://api-m.paypal.com/v1/oauth2/token'
    : 'https://api-m.sandbox.paypal.com/v1/oauth2/token'

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get PayPal access token: ${error}`)
  }

  const data = await response.json()
  return data.access_token
}

async function sendEmail(to: string, subject: string, html: string) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const resendFrom = Deno.env.get('RESEND_FROM') || 'onboarding@resend.dev'

  if (!resendApiKey) {
    console.error("[Email] Missing RESEND_API_KEY")
    return
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `SFXFOLDER.COM <${resendFrom}>`,
      to: [to],
      subject: subject,
      html: html,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error(`[Email] Failed to send email: ${error}`)
  } else {
    console.log(`[Email] Success: Sent "${subject}" to ${to}`)
  }
}

function getRenewalEmailTemplate(subscriptionId: string, nextBillingTime: string) {
  const formattedDate = new Date(nextBillingTime).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Premium Renewed</title>
      <style>
        body { background-color: #0A0A0A; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; color: #FFFFFF; }
        .wrapper { width: 100%; background-color: #0A0A0A; padding-bottom: 60px; }
        .main { background-color: #141414; margin: 0 auto; width: 100%; max-width: 600px; border: 1px solid #333333; border-collapse: collapse; }
        .header { padding: 40px 0; text-align: center; }
        .content { padding: 0 50px 50px 50px; text-align: center; }
        .status-badge { background-color: #22C55E; color: #000000; padding: 10px 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; font-size: 12px; display: inline-block; margin-bottom: 20px; }
        .title { font-size: 28px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #FFFFFF; margin-bottom: 24px; }
        .text { font-size: 16px; line-height: 1.7; color: #A0A0A0; margin-bottom: 30px; }
        .details { background-color: #1A1A1A; padding: 20px; border: 1px solid #333333; margin-bottom: 30px; text-align: left; }
        .detail-row { margin-bottom: 10px; font-size: 14px; color: #FFFFFF; }
        .detail-label { color: #666666; text-transform: uppercase; letter-spacing: 1px; margin-right: 10px; }
        .btn-wrap { text-align: center; padding: 20px 0; }
        .button { background-color: #FACB11; color: #000000 !important; padding: 18px 40px; text-decoration: none; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; display: inline-block; font-size: 14px; }
        .footer { text-align: center; padding: 30px; font-size: 11px; color: #666666; text-transform: uppercase; letter-spacing: 2px; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <img src="https://sfxfolder.com/favicon.png" alt="Sfxfolder" width="140" style="display: block; margin: 0 auto;">
        </div>
        <table class="main">
          <tr>
            <td class="content">
              <div style="padding-top: 40px;">
                <div class="status-badge">Success</div>
              </div>
              <h1 class="title">Premium Renewed</h1>
              <p class="text">
                Good news! Your Sfxfolder Premium subscription has been successfully renewed. You continue to have full access to our exclusive resources.
              </p>
              <div class="details">
                <div class="detail-row"><span class="detail-label">Subscription ID:</span> ${subscriptionId}</div>
                <div class="detail-row"><span class="detail-label">Next Renewal:</span> ${formattedDate}</div>
              </div>
              <div class="btn-wrap">
                <a href="https://sfxfolder.com/account/subscription" class="button">Go to Dashboard</a>
              </div>
            </td>
          </tr>
        </table>
        <div class="footer">
          &copy; Sfxfolder Team. Inspired by excellence.
        </div>
      </div>
    </body>
    </html>
  `
}

function getWelcomeEmailTemplate(subscriptionId: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to Sfxfolder Premium</title>
      <style>
        body { background-color: #0A0A0A; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; color: #FFFFFF; }
        .wrapper { width: 100%; background-color: #0A0A0A; padding-bottom: 60px; }
        .main { background-color: #141414; margin: 0 auto; width: 100%; max-width: 600px; border: 1px solid #333333; border-collapse: collapse; }
        .header { padding: 40px 0; text-align: center; }
        .content { padding: 0 50px 50px 50px; text-align: center; }
        .status-badge { background-color: #22C55E; color: #000000; padding: 10px 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; font-size: 12px; display: inline-block; margin-bottom: 20px; }
        .title { font-size: 28px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #FFFFFF; margin-bottom: 24px; }
        .text { font-size: 16px; line-height: 1.7; color: #A0A0A0; margin-bottom: 30px; }
        .divider { border-top: 1px solid #333333; margin: 30px 0; }
        .btn-wrap { text-align: center; padding: 20px 0; }
        .button { background-color: #FACB11; color: #000000 !important; padding: 18px 40px; text-decoration: none; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; display: inline-block; font-size: 14px; }
        .footer { text-align: center; padding: 30px; font-size: 11px; color: #666666; text-transform: uppercase; letter-spacing: 2px; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <img src="https://sfxfolder.com/favicon.png" alt="Sfxfolder" width="140" style="display: block; margin: 0 auto;">
        </div>
        <table class="main">
          <tr>
            <td class="content">
              <div style="padding-top: 40px;">
                <div class="status-badge">Welcome</div>
              </div>
              <h1 class="title">Welcome Abroad</h1>
              <p class="text">
                Thank you for choosing Sfxfolder Premium. Your account has been upgraded, and you now have full access to our professional library of video editing resources.
              </p>
              <p class="text" style="font-size: 14px;">
                Your Subscription ID: <strong style="color: #FFFFFF;">${subscriptionId}</strong>
              </p>
              <div class="divider"></div>
              <p class="text">
                Ready to elevate your editing game?
              </p>
              <div class="btn-wrap">
                <a href="https://sfxfolder.com" class="button">Start Exploring</a>
              </div>
            </td>
          </tr>
        </table>
        <div class="footer">
          &copy; Sfxfolder Team. Built for Creators.
        </div>
      </div>
    </body>
    </html>
  `
}

function getUpgradeEmailTemplate(subscriptionId: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Premium Upgrade Successful</title>
      <style>
        body { background-color: #0A0A0A; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; color: #FFFFFF; }
        .wrapper { width: 100%; background-color: #0A0A0A; padding-bottom: 60px; }
        .main { background-color: #141414; margin: 0 auto; width: 100%; max-width: 600px; border: 1px solid #333333; border-collapse: collapse; }
        .header { padding: 40px 0; text-align: center; }
        .content { padding: 0 50px 50px 50px; text-align: center; }
        .status-badge { background-color: #22C55E; color: #000000; padding: 10px 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; font-size: 12px; display: inline-block; margin-bottom: 20px; }
        .title { font-size: 28px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #FFFFFF; margin-bottom: 24px; }
        .text { font-size: 16px; line-height: 1.7; color: #A0A0A0; margin-bottom: 30px; }
        .btn-wrap { text-align: center; padding: 20px 0; }
        .button { background-color: #FACB11; color: #000000 !important; padding: 18px 40px; text-decoration: none; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; display: inline-block; font-size: 14px; }
        .footer { text-align: center; padding: 30px; font-size: 11px; color: #666666; text-transform: uppercase; letter-spacing: 2px; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <img src="https://sfxfolder.com/favicon.png" alt="Sfxfolder" width="140" style="display: block; margin: 0 auto;">
        </div>
        <table class="main">
          <tr>
            <td class="content">
              <div style="padding-top: 40px;">
                <div class="status-badge">Upgrade</div>
              </div>
              <h1 class="title">Upgrade Successful</h1>
              <p class="text">
                Your Sfxfolder Premium account has been successfully upgraded. You now have access to a higher tier of professional resources.
              </p>
              <p class="text" style="font-size: 14px;">
                Subscription ID: <strong style="color: #FFFFFF;">${subscriptionId}</strong>
              </p>
              <div class="btn-wrap">
                <a href="https://sfxfolder.com/account/subscription" class="button">Explore New Features</a>
              </div>
            </td>
          </tr>
        </table>
        <div class="footer">
          &copy; Sfxfolder Team. Powering Your Creativity.
        </div>
      </div>
    </body>
    </html>
  `
}

function getPaymentFailedEmailTemplate(subscriptionId: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Payment Action Required</title>
      <style>
        body { background-color: #0A0A0A; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; color: #FFFFFF; }
        .wrapper { width: 100%; background-color: #0A0A0A; padding-bottom: 60px; }
        .main { background-color: #141414; margin: 0 auto; width: 100%; max-width: 600px; border: 1px solid #333333; border-collapse: collapse; }
        .header { padding: 40px 0; text-align: center; }
        .content { padding: 0 50px 50px 50px; text-align: center; }
        .status-badge { background-color: #EF4444; color: #FFFFFF; padding: 10px 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; font-size: 12px; display: inline-block; margin-bottom: 20px; }
        .title { font-size: 28px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #FFFFFF; margin-bottom: 24px; }
        .text { font-size: 16px; line-height: 1.7; color: #A0A0A0; margin-bottom: 30px; }
        .details { background-color: #1A1A1A; padding: 20px; border: 1px solid #333333; margin-bottom: 30px; text-align: left; }
        .detail-row { margin-bottom: 10px; font-size: 14px; color: #FFFFFF; }
        .detail-label { color: #666666; text-transform: uppercase; letter-spacing: 1px; margin-right: 10px; }
        .btn-wrap { text-align: center; padding: 20px 0; }
        .button { background-color: #FACB11; color: #000000 !important; padding: 18px 40px; text-decoration: none; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; display: inline-block; font-size: 14px; }
        .footer { text-align: center; padding: 30px; font-size: 11px; color: #666666; text-transform: uppercase; letter-spacing: 2px; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <img src="https://sfxfolder.com/favicon.png" alt="Sfxfolder" width="140" style="display: block; margin: 0 auto;">
        </div>
        <table class="main">
          <tr>
            <td class="content">
              <div style="padding-top: 40px;">
                <div class="status-badge">Payment Failed</div>
              </div>
              <h1 class="title">Action Required</h1>
              <p class="text">
                We were unable to process your latest payment for Sfxfolder Premium. To keep your access active, please check your payment method on PayPal.
              </p>
              <div class="details">
                <div class="detail-row"><span class="detail-label">Subscription ID:</span> <strong style="color: #FFFFFF;">${subscriptionId}</strong></div>
                <div class="detail-row"><span class="detail-label">Status:</span> <strong style="color: #FFFFFF;">Payment Failed</strong></div>
              </div>
              <div class="btn-wrap">
                <a href="https://sfxfolder.com/account/subscription" class="button">Update Payment Method</a>
              </div>
            </td>
          </tr>
        </table>
        <div class="footer">
          &copy; Sfxfolder Team. Here to help.
        </div>
      </div>
    </body>
    </html>
  `
}

function getExpiryReminderEmailTemplate(subscriptionId: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Subscription Expiry Notice</title>
      <style>
        body { background-color: #0A0A0A; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; color: #FFFFFF; }
        .wrapper { width: 100%; background-color: #0A0A0A; padding-bottom: 60px; }
        .main { background-color: #141414; margin: 0 auto; width: 100%; max-width: 600px; border: 1px solid #333333; border-collapse: collapse; }
        .header { padding: 40px 0; text-align: center; }
        .content { padding: 0 50px 50px 50px; text-align: center; }
        .status-badge { background-color: #F97316; color: #FFFFFF; padding: 10px 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; font-size: 12px; display: inline-block; margin-bottom: 20px; }
        .title { font-size: 28px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #FFFFFF; margin-bottom: 24px; }
        .text { font-size: 16px; line-height: 1.7; color: #A0A0A0; margin-bottom: 30px; }
        .details { background-color: #1A1A1A; padding: 20px; border: 1px solid #333333; margin-bottom: 30px; text-align: left; }
        .detail-row { margin-bottom: 10px; font-size: 14px; color: #FFFFFF; }
        .detail-label { color: #666666; text-transform: uppercase; letter-spacing: 1px; margin-right: 10px; }
        .btn-wrap { text-align: center; padding: 20px 0; }
        .button { background-color: #FACB11; color: #000000 !important; padding: 18px 40px; text-decoration: none; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; display: inline-block; font-size: 14px; }
        .footer { text-align: center; padding: 30px; font-size: 11px; color: #666666; text-transform: uppercase; letter-spacing: 2px; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <img src="https://sfxfolder.com/favicon.png" alt="Sfxfolder" width="140" style="display: block; margin: 0 auto;">
        </div>
        <table class="main">
          <tr>
            <td class="content">
              <div style="padding-top: 40px;">
                <div class="status-badge">Expiry Reminder</div>
              </div>
              <h1 class="title">Subscription Cancelled</h1>
              <p class="text">
                Your Sfxfolder Premium subscription has been cancelled. You will still have access to all premium features until the end of your current billing period.
              </p>
              <div class="details">
                <div class="detail-row"><span class="detail-label">Subscription ID:</span> <strong style="color: #FFFFFF;">${subscriptionId}</strong></div>
                <div class="detail-row"><span class="detail-label">Status:</span> <strong style="color: #FFFFFF;">Scheduled to Expire</strong></div>
              </div>
              <p class="text" style="font-size: 14px;">
                Changed your mind? You can reactivate your subscription anytime to keep the creativity flowing.
              </p>
              <div class="btn-wrap">
                <a href="https://sfxfolder.com/account/subscription" class="button">Reactivate Premium</a>
              </div>
            </td>
          </tr>
        </table>
        <div class="footer">
          &copy; Sfxfolder Team. We hope to see you back.
        </div>
      </div>
    </body>
    </html>
  `
}

async function verifyPayPalSignature(req: Request, body: any, accessToken: string, mode: string, webhookId: string | undefined) {
  if (!webhookId) {
    console.error("[PayPal Webhook] Missing Webhook ID for verification")
    return false
  }

  const url = mode === 'live'
    ? 'https://api-m.paypal.com/v1/notifications/verify-webhook-signature'
    : 'https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature'

  const verificationBody = {
    auth_algo: req.headers.get('paypal-auth-algo'),
    cert_url: req.headers.get('paypal-cert-url'),
    transmission_id: req.headers.get('paypal-transmission-id'),
    transmission_sig: req.headers.get('paypal-transmission-sig'),
    transmission_time: req.headers.get('paypal-transmission-time'),
    webhook_id: webhookId,
    webhook_event: body,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(verificationBody),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error(`[PayPal Webhook] Signature verification API error: ${error}`)
    return false
  }

  const data = await response.json()
  return data.verification_status === 'SUCCESS'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Automatically detect environment based on function name in URL
    const isDev = req.url.includes('paypal-webhook-dev')

    // Determine mode and fetch corresponding credentials
    const mode = isDev ? 'sandbox' : (Deno.env.get('PAYPAL_MODE') || 'live')

    const clientId = isDev
      ? Deno.env.get('PAYPAL_CLIENT_ID_SANDBOX')
      : (Deno.env.get('PAYPAL_CLIENT_ID_LIVE') || Deno.env.get('PAYPAL_CLIENT_ID') || '')

    const secret = isDev
      ? Deno.env.get('PAYPAL_SECRET_SANDBOX')
      : (Deno.env.get('PAYPAL_SECRET_LIVE') || Deno.env.get('PAYPAL_SECRET') || '')

    const webhookId = isDev
      ? Deno.env.get('PAYPAL_WEBHOOK_ID_SANDBOX')
      : (Deno.env.get('PAYPAL_WEBHOOK_ID_LIVE') || Deno.env.get('PAYPAL_WEBHOOK_ID') || '')

    const body = await req.json()
    const eventType = body.event_type
    const resource = body.resource

    console.log(`[PayPal Webhook] Incoming Event: ${eventType} Mode: ${mode} (isDev: ${isDev})`)

    if (!clientId || !secret) {
      throw new Error(`Missing PayPal credentials for mode: ${mode}`)
    }

    const accessToken = await getPayPalAccessToken(clientId, secret, mode)
    const isValid = await verifyPayPalSignature(req, body, accessToken, mode, webhookId)

    if (!isValid) {
      console.error(`[PayPal Webhook] Signature verification FAILED (Mode: ${mode}, WebhookID: ${webhookId?.substring(0, 5)}...)`)
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!eventType || !resource || !resource.id) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers: corsHeaders })
    }

    const subscriptionID = resource.id

    const { data: currentSub } = await supabase
      .from("subscriptions")
      .select("auto_renew, status")
      .eq("paypal_subscription_id", subscriptionID)
      .single()

    if (eventType.startsWith("BILLING.SUBSCRIPTION.")) {
      let status = resource.status
      const nextBillingTime = resource.billing_info?.next_billing_time

      if (eventType === "BILLING.SUBSCRIPTION.RENEWED" && currentSub?.auto_renew === false) {
        status = "CANCELLED"
      }

      const updateData: any = { status, updated_at: new Date().toISOString() }
      if (nextBillingTime) updateData.current_period_end = nextBillingTime

      await supabase.from("subscriptions").update(updateData).eq("paypal_subscription_id", subscriptionID)

      // Fetch user email for notification
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("subscription_id", subscriptionID)
        .single()

      if (profile?.email) {
        console.log(`[Email] Found profile for ${subscriptionID}: ${profile.email}`)
        if (eventType === "BILLING.SUBSCRIPTION.CREATED") {
          const emailHtml = getWelcomeEmailTemplate(subscriptionID)
          await sendEmail(profile.email, "Welcome to Sfxfolder Premium — Subscription Confirmed", emailHtml)
        } else if (eventType === "BILLING.SUBSCRIPTION.UPDATED") {
          const emailHtml = getUpgradeEmailTemplate(subscriptionID)
          await sendEmail(profile.email, "Sfxfolder Premium — Plan Upgraded Successfully", emailHtml)
        } else if (eventType === "BILLING.SUBSCRIPTION.PAYMENT.FAILED") {
          const emailHtml = getPaymentFailedEmailTemplate(subscriptionID)
          await sendEmail(profile.email, "Action Required: Payment Failed for Sfxfolder Premium", emailHtml)
        } else if (eventType === "BILLING.SUBSCRIPTION.CANCELLED") {
          const emailHtml = getExpiryReminderEmailTemplate(subscriptionID)
          await sendEmail(profile.email, "Sfxfolder Premium — Subscription Expiry Reminder", emailHtml)
        } else if ((eventType === "BILLING.SUBSCRIPTION.RENEWED" || eventType === "BILLING.SUBSCRIPTION.ACTIVATED") && status === "ACTIVE") {
          const emailHtml = getRenewalEmailTemplate(subscriptionID, nextBillingTime)
          await sendEmail(profile.email, "Sfxfolder Premium — Renewal Successful", emailHtml)
        } else {
          console.log(`[Email] Event ${eventType} with status ${status} does not trigger an email.`)
        }
      } else {
        console.warn(`[Email] No profile found with subscription_id: ${subscriptionID}. Email skipped.`)
      }

      await supabase.from("profiles").update({
        subscription_status: status.toLowerCase(),
        subscription_expires_at: nextBillingTime
      }).eq("subscription_id", subscriptionID)

      console.log(`[PayPal Webhook] Success: Updated ${subscriptionID} to ${status}`)
      return new Response(JSON.stringify({ success: true, status }), { headers: corsHeaders })
    }

    return new Response(JSON.stringify({ success: true, ignored: true }), { headers: corsHeaders })

  } catch (err) {
    console.error("[PayPal Webhook] Fatal Error:", err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
