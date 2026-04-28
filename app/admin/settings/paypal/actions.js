"use server";

import { createServerClient } from "@supabase/ssr";
import { revalidateTag, revalidatePath } from "next/cache";

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_key';

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() { return []; },
        setAll() { },
      },
    }
  );
}

export async function updatePaypalConfig(config) {
  try {
    const supabase = getAdminSupabase();

    const { error } = await supabase
      .from("system_settings")
      .upsert({
        setting_key: "paypal_config",
        setting_value: config,
        updated_at: new Date().toISOString()
      }, { onConflict: "setting_key" });

    if (error) {
      console.error("DB Error updating config:", error);
      return { success: false, error: "Failed to update settings" };
    }


    // Clear cache to reflect changes immediately
    revalidateTag('settings', 'max');
    revalidatePath('/pricing');

    return { success: true };
  } catch (err) {
    console.error("Error in updatePaypalConfig:", err);
    return { success: false, error: err.message };
  }
}
