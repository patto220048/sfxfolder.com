import { NextResponse } from "next/server";
import { getResources } from "@/app/lib/api";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract parameters from URL
    const categorySlug = searchParams.get("categorySlug");
    const folderId = searchParams.get("folderId") === "null" ? null : searchParams.get("folderId");
    const offset = parseInt(searchParams.get("offset") || "0");
    const limit = parseInt(searchParams.get("limit") || "20");
    const selectedTags = searchParams.get("tags") ? searchParams.get("tags").split(",") : [];
    const selectedFormats = searchParams.get("formats") ? searchParams.get("formats").split(",") : [];
    const searchTerm = searchParams.get("search") || "";
    const sortOrder = searchParams.get("sort") || "newest";

    const resources = await getResources({
      categorySlug,
      folderId,
      offset,
      limit,
      selectedTags,
      selectedFormats,
      searchTerm,
      sortOrder
    });

    return NextResponse.json(resources);
  } catch (error) {
    console.error("API Resources Error:", error);
    return NextResponse.json({ error: "Failed to fetch resources" }, { status: 500 });
  }
}
