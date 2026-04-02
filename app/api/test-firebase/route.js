import { NextResponse } from "next/server";
import { db, auth, storage } from "@/app/lib/firebase";
import { collection, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, listAll } from "firebase/storage";

export async function GET() {
  const results = {
    firebase: false,
    firestore: false,
    storage: false,
    collections: {},
    errors: [],
  };

  try {
    // Test Firestore connection
    const testRef = collection(db, "settings");
    const snapshot = await getDocs(testRef);
    results.firestore = true;
    results.collections.settings = snapshot.size;

    // Check other collections
    for (const col of ["resources", "categories", "folders"]) {
      try {
        const colRef = collection(db, col);
        const colSnap = await getDocs(colRef);
        results.collections[col] = colSnap.size;
      } catch (e) {
        results.collections[col] = `Error: ${e.message}`;
      }
    }

    // Test Storage connection
    try {
      const storageRef = ref(storage, "resources");
      await listAll(storageRef);
      results.storage = true;
    } catch (e) {
      // Storage might be empty but still connected
      if (e.code === "storage/object-not-found" || e.code === "storage/unauthorized") {
        results.storage = true; // Connected but empty/restricted
      } else {
        results.errors.push(`Storage: ${e.message}`);
      }
    }

    results.firebase = true;

    return NextResponse.json(results);
  } catch (error) {
    results.errors.push(error.message);
    return NextResponse.json(results, { status: 500 });
  }
}
