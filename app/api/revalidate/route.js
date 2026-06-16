import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/**
 * On-demand revalidation API.
 * Usage: GET /api/revalidate?path=/shop&secret=YOUR_SECRET
 * 
 * Requires REVALIDATION_SECRET env var to be set for security.
 * If not set, falls back to SUPABASE_SERVICE_ROLE_KEY as secret.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");
    const secret = searchParams.get("secret");

    // Security: require a secret token
    const expectedSecret =
      process.env.REVALIDATION_SECRET ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!expectedSecret || secret !== expectedSecret) {
      return NextResponse.json(
        { error: "Invalid secret" },
        { status: 401 }
      );
    }

    if (!path) {
      return NextResponse.json(
        { error: "Missing 'path' query parameter" },
        { status: 400 }
      );
    }

    revalidatePath(path);

    return NextResponse.json({
      revalidated: true,
      path,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Revalidate] Error:", error);
    return NextResponse.json(
      { error: "Failed to revalidate" },
      { status: 500 }
    );
  }
}
