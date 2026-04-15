import { NextResponse } from "next/server";
import { searchResources } from "@/app/lib/api";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";

    if (!q) {
      return NextResponse.json({ results: [], query: q });
    }

    const results = await searchResources(q);

    return NextResponse.json({ results, query: q });
  } catch (error) {
    console.error("Search API failed:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
