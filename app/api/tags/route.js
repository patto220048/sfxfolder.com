import { NextResponse } from "next/server";
import { getTags } from "@/app/lib/api";

// Cấu hình ISR hoặc dynamic
export const dynamic = 'force-dynamic';

/**
 * API route công khai trả về toàn bộ danh sách tags sử dụng server-side cache
 */
export async function GET() {
  try {
    const tags = await getTags();
    return NextResponse.json(tags);
  } catch (error) {
    console.error("API Tags Error:", error);
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }
}
