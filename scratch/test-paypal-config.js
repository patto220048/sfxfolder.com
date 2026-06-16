const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
    realtime: { transport: {} }
  }
);

async function testConfig() {
  console.log('--- ENV CONFIG ---');
  console.log('PAYPAL_MODE:', process.env.PAYPAL_MODE);
  console.log('PAYPAL_CLIENT_ID:', process.env.PAYPAL_CLIENT_ID);
  console.log('PAYPAL_SECRET_SANDBOX:', process.env.PAYPAL_SECRET_SANDBOX ? 'DEFINED (Ends with ' + process.env.PAYPAL_SECRET_SANDBOX.slice(-5) + ')' : 'UNDEFINED');
  console.log('PAYPAL_SECRET_LIVE:', process.env.PAYPAL_SECRET_LIVE ? 'DEFINED' : 'UNDEFINED');

  console.log('\n--- DB CONFIG ---');
  const { data: settings, error } = await supabaseAdmin
    .from("system_settings")
    .select("setting_value")
    .eq("setting_key", "paypal_config")
    .single();

  if (error) {
    console.error('Error fetching settings:', error);
  } else {
    console.log('Settings in DB:', JSON.stringify(settings.setting_value, null, 2));
  }
}

testConfig();
