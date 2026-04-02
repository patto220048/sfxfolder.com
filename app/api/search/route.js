import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";

    // In production, this calls searchResources from firestore.js
    // For now, return empty results
    // const results = await searchResources(q);

    return NextResponse.json({ results: [], query: q });
  } catch (error) {
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
