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

async function verifyPayPalSignature(req: Request, body: any, accessToken: string) {
  const mode = Deno.env.get('PAYPAL_MODE') || 'sandbox'
  const webhookId = Deno.env.get('PAYPAL_WEBHOOK_ID')
  
  if (!webhookId) return false

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

    const clientId = Deno.env.get('PAYPAL_CLIENT_ID') ?? ''
    const secret = Deno.env.get('PAYPAL_SECRET') ?? ''
    const mode = Deno.env.get('PAYPAL_MODE') ?? 'sandbox'

    const body = await req.json()
    const eventType = body.event_type
    const resource = body.resource

    console.log(`[PayPal Webhook] Incoming Event: ${eventType} Mode: ${mode}`)

    const accessToken = await getPayPalAccessToken(clientId, secret, mode)
    const isValid = await verifyPayPalSignature(req, body, accessToken)

    if (!isValid) {
      console.error("[PayPal Webhook] Signature verification FAILED")
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
