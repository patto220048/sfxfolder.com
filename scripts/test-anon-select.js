require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Missing env keys!");
  process.exit(1);
}

async function main() {
  console.log("Checking select using Anon Key via REST API...");
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts?select=id,title,slug,status`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    console.log("Status:", res.status);
    const data = await res.json();
    if (res.status !== 200) {
      console.error("❌ Error response:", data);
      return;
    }

    console.log(`✅ Success! Found ${data.length} post(s):`);
    data.forEach((p, idx) => {
      console.log(`  - #${idx + 1}: ${p.title} (${p.status})`);
    });
  } catch (err) {
    console.error("❌ Fetch failed:", err);
  }
}

main();
