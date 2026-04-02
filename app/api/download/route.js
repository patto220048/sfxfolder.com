import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { resourceId } = await request.json();

    if (!resourceId) {
      return NextResponse.json({ error: "resourceId is required" }, { status: 400 });
    }

    // In production, this calls incrementDownloadCount from firestore.js
    // For now, return success
    // await incrementDownloadCount(resourceId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to record download" }, { status: 500 });
  }
}
