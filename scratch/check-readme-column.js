const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
    realtime: {
      transport: {
        // Bypass websocket
      }
    }
  }
);

async function check() {
  const { data, error } = await supabase
    .from('sound_packs')
    .select('custom_readme')
    .limit(1);

  if (error) {
    console.error('Column custom_readme does not exist or fetch error:', error.message);
  } else {
    console.log('Column custom_readme exists successfully! Data:', data);
  }
}

check();
