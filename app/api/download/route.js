import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/app/lib/supabase-server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { incrementDownloadCount } from "@/app/lib/api";

export async function POST(request) {
  try {
    const { resourceId } = await request.json();

    if (!resourceId) {
      return NextResponse.json(
        { error: "resourceId is required" },
        { status: 400 }
      );
    }

    // 1. Check if user is authenticated
    const supabase = await createServerSupabaseClient();
    let {
      data: { user },
    } = await supabase.auth.getUser();

    // Fallback: Check Authorization header (required for some plugin environments where cookies are blocked)
    if (!user) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const { data: { user: headerUser }, error: headerError } = await supabase.auth.getUser(token);
        if (!headerError && headerUser) {
          user = headerUser;
          console.log("[DownloadAPI] Authenticated via Authorization header:", user.email);
        }
      }
    }

    // 2. Check if the resource exists
    const { data: resource } = await supabaseAdmin
      .from("resources")
      .select("id, is_premium, download_url, name, storage_path, file_name, file_format")
      .eq("id", resourceId)
      .single();

    if (!resource) {
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 }
      );
    }

    // 3. Get user profile if authenticated
    let profile = null;
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("role, daily_download_count, last_download_date")
        .eq("id", user.id)
        .single();
      profile = data;
    }

    // --- RATE LIMITING LOGIC (For logged-in users only) ---
    const MAX_DAILY_DOWNLOADS = 200;
    const today = new Date().toISOString().split('T')[0]; // Định dạng YYYY-MM-DD
    
    let currentCount = profile?.daily_download_count || 0;
    const lastDate = profile?.last_download_date;

    // Reset bộ đếm nếu là ngày mới
    if (lastDate !== today) {
      currentCount = 0;
    }

    // Admin không bị giới hạn
    if (user && profile?.role !== "admin" && currentCount >= MAX_DAILY_DOWNLOADS) {
      return NextResponse.json(
        { error: `Bạn đã đạt giới hạn tải xuống ${MAX_DAILY_DOWNLOADS} file/ngày. Vui lòng quay lại vào ngày mai.` },
        { status: 429 }
      );
    }
    // --- END RATE LIMITING LOGIC ---

    // 4. Increment download count (don't let this block the download if it fails)
    try {
      // Tăng số lượt tải của tài nguyên
      await incrementDownloadCount(resourceId);
      
      // Cập nhật số lượt tải trong ngày của User (nếu có đăng nhập)
      if (user) {
        await supabaseAdmin
          .from("profiles")
          .update({
            daily_download_count: currentCount + 1,
            last_download_date: today
          })
          .eq("id", user.id);
      }
    } catch (e) {
      console.warn("Failed to update download stats:", e);
    }

    // 5. Generate Signed URL for secure native download
    let finalDownloadUrl = resource.download_url;

    if (resource.storage_path) {
      // Build a clean download filename
      let baseName = resource.name || "download";
      
      // Sanitize filename: remove illegal characters that might cause browsers to ignore the name
      baseName = baseName.replace(/[/\\?%*:|"<>]/g, '-').trim();

      const extension = resource.file_format 
        ? `.${resource.file_format.toLowerCase().replace(/^\./, "")}` 
        : (resource.file_name?.split('.').pop() ? `.${resource.file_name.split('.').pop()}` : "");
      
      const downloadName = baseName.endsWith(extension) ? baseName : `${baseName}${extension}`;

      // USE ADMIN CLIENT for storage to ensure permissions and stability
      const { data: signedData, error: signedError } = await supabaseAdmin.storage
        .from("resources")
        .createSignedUrl(resource.storage_path, 60, {
          download: downloadName,
        });

      if (!signedError && signedData?.signedUrl) {
        finalDownloadUrl = signedData.signedUrl;
      } else {
        console.error("Storage error:", signedError);
      }
    }

    // 6. Return download URL
    return NextResponse.json({
      success: true,
      downloadUrl: finalDownloadUrl,
    });
  } catch (error) {
    console.error("Download API error:", error);
    return NextResponse.json(
      { error: "Failed to process download" },
      { status: 500 }
    );
  }
}
