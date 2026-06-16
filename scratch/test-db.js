const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
    realtime: {
      transport: {
        // Mock websocket to bypass native check if we don't need realtime
      }
    }
  }
);

async function check() {
  const { data: packs, error } = await supabase
    .from('sound_packs')
    .select('id, name, slug, status, price');
  
  if (error) {
    console.error('Error fetching packs:', error);
  } else {
    console.log('Packs in DB:', packs);
  }
}

check();
