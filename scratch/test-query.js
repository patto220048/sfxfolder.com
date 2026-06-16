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

async function testQuery() {
  const packId = '5f436ddb-5559-4d3a-a622-aac06eb08974';
  
  const { data: pack, error: packError } = await supabaseAdmin
    .from("sound_packs")
    .select("id, name, price, currency, status")
    .eq("id", packId)
    .single();

  console.log('Query result:', { pack, packError });
}

testQuery();
