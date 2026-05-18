import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { getServerUser } from "@/app/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * Verify admin authentication
 */
async function verifyAdmin() {
  const { user: adminUser } = await getServerUser();
  if (!adminUser) return { error: "Unauthorized", status: 401 };

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", adminUser.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    return { error: "Forbidden", status: 403 };
  }

  return { adminUser };
}

/**
 * POST handler to generate cover image using Gemini Imagen 3 and upload to Supabase
 */
export async function POST(req) {
  try {
    // 1. Verify admin auth
    const auth = await verifyAdmin();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // 2. Parse request body
    const body = await req.json();
    const { prompt, slug } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required for image generation" }, { status: 400 });
    }

    const safeSlug = slug ? slug.replace(/[^\w\-]+/g, "") : `img-${Date.now()}`;
    const storagePath = `blog-covers/${safeSlug}-${Date.now()}.jpg`;

    // 3. Extract Gemini API key
    const customGeminiKey = req.headers.get("x-custom-gemini-key") || null;
    const apiKey = customGeminiKey || process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === "your_gemini_api_key") {
      return NextResponse.json(
        { error: "Vui lòng cấu hình Gemini API Key trong phần cài đặt của Admin panel trước khi tạo ảnh!" },
        { status: 400 }
      );
    }

    console.log(`[AI GenImage] Generating cover image for prompt: "${prompt}"...`);

    // 4. Call Gemini Imagen 3 API
    const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict`;
    const response = await fetch(`${imagenUrl}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [
          {
            prompt: prompt,
          },
        ],
        parameters: {
          sampleCount: 1,
          aspectRatio: "16:9",
          outputMimeType: "image/jpeg",
        },
      }),
    });

    if (!response.ok) {
      const errorMsg = await response.text();
      console.error("[AI GenImage] Imagen 3 Error Response:", errorMsg);
      throw new Error(`Imagen 3 API failed: ${response.statusText} - ${errorMsg}`);
    }

    const result = await response.json();
    const base64Image = result.predictions?.[0]?.bytesBase64Encoded;

    if (!base64Image) {
      console.error("[AI GenImage] Predictions structure:", JSON.stringify(result));
      throw new Error("Không nhận được dữ liệu ảnh từ Imagen 3 API.");
    }

    console.log(`[AI GenImage] Image generated successfully. Uploading to storage: ${storagePath}...`);

    // 5. Decode Base64 string to Buffer
    const imageBuffer = Buffer.from(base64Image, "base64");

    // 6. Upload Buffer directly to Supabase storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("resources")
      .upload(storagePath, imageBuffer, {
        contentType: "image/jpeg",
        cacheControl: "31536000",
        upsert: true,
      });

    if (uploadError) {
      console.error("[AI GenImage] Supabase Storage upload error:", uploadError);
      throw uploadError;
    }

    // 7. Get CDN public URL
    const { data: urlData } = supabaseAdmin.storage
      .from("resources")
      .getPublicUrl(storagePath);

    const publicUrl = urlData?.publicUrl;
    console.log(`[AI GenImage] Upload completed. CDN public URL: ${publicUrl}`);

    return NextResponse.json({
      success: true,
      cover_image: publicUrl,
    });
  } catch (err) {
    console.error("[AI GenImage] Core Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
