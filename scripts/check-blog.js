require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing env keys!");
  process.exit(1);
}

// Hạn chế lỗi Node.js < 22 thiếu WebSocket cho Supabase Realtime (chúng ta không dùng Realtime ở đây)
if (typeof global.WebSocket === 'undefined') {
  global.WebSocket = class {};
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log("Checking blog posts in database...");
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*');

  if (error) {
    console.error("Error querying blog posts:", error.message);
    return;
  }

  console.log(`Found ${data.length} post(s):`);
  data.forEach((p, idx) => {
    console.log(`\n--- Post #${idx + 1} ---`);
    console.log(`ID: ${p.id}`);
    console.log(`Title: ${p.title}`);
    console.log(`Slug: ${p.slug}`);
    console.log(`Status: ${p.status}`);
    console.log(`Created At: ${p.created_at}`);
  });
}

main();
