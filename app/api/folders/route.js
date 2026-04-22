import { NextResponse } from "next/server";
import { getFolders } from "@/app/lib/api";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const categorySlug = searchParams.get("categorySlug");
    const parentFolderId = searchParams.get("parentFolderId") === "null" ? null : searchParams.get("parentFolderId");

    const folders = await getFolders(categorySlug, parentFolderId);

    return NextResponse.json(folders);
  } catch (error) {
    console.error("API Folders Error:", error);
    return NextResponse.json({ error: "Failed to fetch folders" }, { status: 500 });
  }
}
