import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUrl(url) {
  try {
    // Supabase sometimes returns 200 for HEAD even if file is missing,
    // so we use GET but with Range to only fetch 1 byte to save bandwidth
    const res = await fetch(url, { 
      method: 'GET',
      headers: { 'Range': 'bytes=0-0' }
    });
    return res.status;
  } catch (err) {
    return 500;
  }
}

async function run() {
  console.log("Fetching all resources from database...");
  const { data: resources, error } = await supabase
    .from('resources')
    .select('id, name, preview_url, download_url, storage_path');

  if (error) {
    console.error("Error fetching resources:", error);
    return;
  }

  console.log(`Found ${resources.length} resources. Checking for broken links...`);
  
  let brokenCount = 0;
  
  const isDryRun = process.argv.includes('--dry-run');
  if (isDryRun) {
    console.log("Running in DRY RUN mode. No data will be deleted.");
  }

  for (const item of resources) {
    const urlToCheck = item.preview_url || item.download_url;
    if (!urlToCheck) continue;

    const status = await checkUrl(urlToCheck);
    
    if (status === 404 || status === 400) {
      console.log(`[BROKEN] ${item.name} - ${urlToCheck} (Status: ${status})`);
      
      if (!isDryRun) {
        // Delete from database
        const { error: delError } = await supabase
          .from('resources')
          .delete()
          .eq('id', item.id);
          
        if (delError) {
          console.error(`  -> Failed to delete ${item.id}:`, delError);
        } else {
          console.log(`  -> Deleted from database.`);
          brokenCount++;
        }
      } else {
        brokenCount++;
      }
    }
  }

  if (isDryRun) {
    console.log(`\nDry run complete! Found ${brokenCount} broken resources that would be deleted.`);
  } else {
    console.log(`\nCleanup complete! Deleted ${brokenCount} broken resources.`);
  }
}

run();
