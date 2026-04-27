#with dev
npx supabase secrets set --env-file supabase/secrets.dev.env

#with production
npx supabase secrets set --env-file supabase/secrets.prod.env

#deploy
  npx supabase functions deploy paypal-webhook
