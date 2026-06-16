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

async function checkPreviewable() {
  const slug = '150-meme-sound-effects';
  
  // 1. Fetch pack
  const { data: pack, error: packError } = await supabaseAdmin
    .from("sound_packs")
    .select("id, name, status")
    .eq("slug", slug)
    .single();

  if (packError || !pack) {
    console.error('Pack not found:', packError);
    return;
  }

  console.log('Pack details:', pack);

  // 2. Fetch pack items
  const { data: items, error: itemsError } = await supabaseAdmin
    .from("sound_pack_items")
    .select("id, file_name, is_previewable")
    .eq("pack_id", pack.id)
    .order("sort_order", { ascending: true });

  if (itemsError) {
    console.error('Failed to fetch items:', itemsError);
    return;
  }

  console.log(`Found ${items.length} items.`);
  const previewableItems = items.filter(item => item.is_previewable);
  console.log(`Previewable items count: ${previewableItems.length}`);
  
  if (previewableItems.length > 0) {
    console.log('First 5 previewable items:');
    console.log(previewableItems.slice(0, 5));
  } else {
    console.log('No previewable items found in database (all are successfully disabled).');
  }
}

checkPreviewable();
