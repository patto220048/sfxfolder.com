import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Admin client — bypasses RLS.
 * ONLY use on the server (API routes, webhooks, server actions).
 * NEVER expose SUPABASE_SERVICE_ROLE_KEY to the client.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Tải ảnh từ URL bên ngoài và upload lên Supabase Storage bucket 'site-assets'.
 * Trả về link public CDN của Supabase.
 */
export async function ensureSupabaseImage(imageUrl, slug) {
  if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
    // Sử dụng ảnh mặc định nếu không có ảnh
    imageUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200';
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  // Nếu đã là ảnh lưu trên Supabase site-assets của chúng ta, trả về luôn
  if (supabaseUrl && imageUrl.includes(supabaseUrl) && imageUrl.includes('site-assets')) {
    return imageUrl;
  }

  try {
    console.log(`[ensureSupabaseImage] Downloading external image: ${imageUrl}`);
    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch external image: ${res.statusText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const cleanSlug = slug ? slug.replace(/[^\w\-]+/g, '') : `cover-${Date.now()}`;
    const filename = `${cleanSlug}-${Date.now()}.jpg`;
    const storagePath = `blog-covers/${filename}`;

    console.log(`[ensureSupabaseImage] Uploading to Supabase Storage: site-assets / ${storagePath}`);
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('site-assets')
      .upload(storagePath, buffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabaseAdmin.storage.from('site-assets').getPublicUrl(storagePath);
    console.log(`[ensureSupabaseImage] Successfully uploaded. Public CDN URL: ${data.publicUrl}`);
    return data.publicUrl;
  } catch (error) {
    console.error(`[ensureSupabaseImage] Error processing image:`, error);
    // Trả về ảnh gốc làm fallback nếu quá trình tải/upload lỗi
    return imageUrl;
  }
}

