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
    const { prompt, slug, model } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required for image generation" }, { status: 400 });
    }

    let selectedModel = model || "pollinations";
    if (selectedModel === "imagen-3") {
      selectedModel = "imagen-4.0-generate-001";
    }
    const safeSlug = slug ? slug.replace(/[^\w\-]+/g, "") : `img-${Date.now()}`;

    // Extract API keys from headers or environment
    const customGeminiKey = req.headers.get("x-custom-gemini-key") || null;
    const customOpenAIKey = req.headers.get("x-custom-openai-key") || null;

    let imageBuffer;
    let contentType = "image/jpeg";

    if (selectedModel.startsWith("dall-e")) {
      const openAIKey = customOpenAIKey || process.env.OPENAI_API_KEY;
      if (!openAIKey) {
        return NextResponse.json(
          { error: "Vui lòng cấu hình OpenAI API Key trong phần cài đặt của Admin panel trước khi tạo ảnh DALL-E!" },
          { status: 400 }
        );
      }

      console.log(`[AI GenImage] Generating cover image using ${selectedModel} via OpenAI...`);
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAIKey}`,
        },
        body: JSON.stringify({
          model: selectedModel === "dall-e-3" ? "dall-e-3" : "dall-e-2",
          prompt: prompt,
          n: 1,
          size: selectedModel === "dall-e-3" ? "1792x1024" : "1024x1024",
          response_format: "b64_json",
        }),
      });

      if (!response.ok) {
        const errorMsg = await response.text();
        console.error("[AI GenImage] DALL-E Error Response:", errorMsg);
        throw new Error(`DALL-E API failed: ${response.statusText} - ${errorMsg}`);
      }

      const result = await response.json();
      const base64Image = result.data?.[0]?.b64_json;
      if (!base64Image) {
        throw new Error("Không nhận được dữ liệu ảnh từ DALL-E API.");
      }
      imageBuffer = Buffer.from(base64Image, "base64");
      contentType = "image/png";
    } else if (selectedModel === "pollinations" || selectedModel === "free-ai") {
      console.log(`[AI GenImage] Generating cover image using Pollinations AI (Free)...`);
      const encodedPrompt = encodeURIComponent(prompt);
      const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=576&model=flux&nologo=true`;
      
      const response = await fetch(pollinationsUrl);
      if (!response.ok) {
        throw new Error(`Pollinations AI API failed: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      contentType = "image/jpeg";
    } else {
      // Default to Google Imagen 4
      const apiKey = customGeminiKey || process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "your_gemini_api_key") {
        return NextResponse.json(
          { error: "Vui lòng cấu hình Gemini API Key trong phần cài đặt của Admin panel trước khi tạo ảnh!" },
          { status: 400 }
        );
      }

      try {
        console.log(`[AI GenImage] Generating cover image using ${selectedModel} via Google AI...`);
        const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:predict`;
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
          console.warn(`[AI GenImage] Google Imagen failed: ${errorMsg}. Attempting automatic fallback to Pollinations AI (Free)...`);
          
          // Automatic graceful fallback to Pollinations AI!
          const encodedPrompt = encodeURIComponent(prompt);
          const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=576&model=flux&nologo=true`;
          
          const pollRes = await fetch(pollinationsUrl);
          if (!pollRes.ok) {
            throw new Error(`Fallback Pollinations AI failed: ${pollRes.statusText}`);
          }
          
          const arrayBuffer = await pollRes.arrayBuffer();
          imageBuffer = Buffer.from(arrayBuffer);
          contentType = "image/jpeg";
        } else {
          const result = await response.json();
          const base64Image = result.predictions?.[0]?.bytesBase64Encoded;

          if (!base64Image) {
            console.warn(`[AI GenImage] predictions structure is empty. Attempting automatic fallback to Pollinations AI...`);
            const encodedPrompt = encodeURIComponent(prompt);
            const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=576&model=flux&nologo=true`;
            
            const pollRes = await fetch(pollinationsUrl);
            if (!pollRes.ok) {
              throw new Error(`Fallback Pollinations AI failed: ${pollRes.statusText}`);
            }
            
            const arrayBuffer = await pollRes.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuffer);
            contentType = "image/jpeg";
          } else {
            imageBuffer = Buffer.from(base64Image, "base64");
            contentType = "image/jpeg";
          }
        }
      } catch (err) {
        console.warn(`[AI GenImage] Catch block triggered: ${err.message}. Running fallback to Pollinations AI...`);
        const encodedPrompt = encodeURIComponent(prompt);
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=576&model=flux&nologo=true`;
        
        const pollRes = await fetch(pollinationsUrl);
        if (!pollRes.ok) {
          throw new Error(`Fallback Pollinations AI failed: ${pollRes.statusText}`);
        }
        
        const arrayBuffer = await pollRes.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
        contentType = "image/jpeg";
      }
    }

    const ext = contentType === "image/png" ? "png" : "jpg";
    const storagePath = `blog-covers/${safeSlug}-${Date.now()}.${ext}`;

    console.log(`[AI GenImage] Image generated successfully. Uploading to site-assets storage: ${storagePath}...`);

    // 5. Upload Buffer directly to Supabase storage (site-assets bucket)
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("site-assets")
      .upload(storagePath, imageBuffer, {
        contentType: contentType,
        cacheControl: "31536000",
        upsert: true,
      });

    if (uploadError) {
      console.error("[AI GenImage] Supabase Storage upload error:", uploadError);
      throw uploadError;
    }

    // 6. Get CDN public URL
    const { data: urlData } = supabaseAdmin.storage
      .from("site-assets")
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
