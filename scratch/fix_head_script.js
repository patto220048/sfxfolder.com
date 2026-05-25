const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

async function fixSettings() {
  try {
    const getUrl = `${supabaseUrl}/rest/v1/site_settings?id=eq.1`;
    const response = await fetch(getUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch settings: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data || data.length === 0) {
      console.error("No settings found in database.");
      return;
    }

    const settings = data[0];
    const adsConfig = settings.ads_config || {};
    let headScript = adsConfig.head_script || '';

    console.log("Original head_script:\n", headScript);

    // Replace the malformed script tag wrapping the meta tag
    const malformedPattern = /<script>\s*<meta name="monetag" content="df3ed8295ac0007c8be6d6fe92072191">\s*<\/script>/i;
    const cleanReplacement = '<meta name="monetag" content="df3ed8295ac0007c8be6d6fe92072191">';

    if (malformedPattern.test(headScript)) {
      headScript = headScript.replace(malformedPattern, cleanReplacement);
      console.log("Cleaned head_script:\n", headScript);

      // Save it back to the DB
      const updateUrl = `${supabaseUrl}/rest/v1/site_settings?id=eq.1`;
      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          ads_config: {
            ...adsConfig,
            head_script: headScript
          }
        })
      });

      if (!updateResponse.ok) {
        throw new Error(`Failed to update settings: ${await updateResponse.text()}`);
      }

      console.log("Successfully updated settings in the database!");
    } else {
      console.log("The malformed monetag script was not found or has already been fixed.");
    }
  } catch (err) {
    console.error("Error fixing settings:", err);
  }
}

fixSettings();
