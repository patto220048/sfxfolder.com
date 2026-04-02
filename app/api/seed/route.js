import { NextResponse } from "next/server";
import { db } from "@/app/lib/firebase";
import { collection, doc, setDoc, getDocs, serverTimestamp } from "firebase/firestore";

const CATEGORIES = [
  { slug: "sound-effects", name: "Sound Effects", icon: "volume-2", color: "#00F0FF", order: 0, formats: ["mp3", "wav", "ogg"] },
  { slug: "music", name: "Music", icon: "music", color: "#A855F7", order: 1, formats: ["mp3", "wav", "flac"] },
  { slug: "video-meme", name: "Video Meme", icon: "film", color: "#FBBF24", order: 2, formats: ["mp4", "webm", "gif"] },
  { slug: "green-screen", name: "Green Screen", icon: "monitor", color: "#22C55E", order: 3, formats: ["mp4", "mov", "webm"] },
  { slug: "animation", name: "Animation", icon: "sparkles", color: "#F43F5E", order: 4, formats: ["mp4", "gif", "webm"] },
  { slug: "image-overlay", name: "Image & Overlay", icon: "image", color: "#F97316", order: 5, formats: ["png", "jpg", "webp"] },
  { slug: "font", name: "Font", icon: "type", color: "#E2E8F0", order: 6, formats: ["ttf", "otf", "woff2"] },
  { slug: "preset-lut", name: "Preset & LUT", icon: "sliders", color: "#6366F1", order: 7, formats: ["cube", "xmp", "lut"] },
];

const FOLDERS = [
  // Sound Effects
  { categorySlug: "sound-effects", name: "Transition", path: "Transition", order: 0, children: ["Whoosh", "Swoosh", "Glitch"] },
  { categorySlug: "sound-effects", name: "Impact", path: "Impact", order: 1, children: ["Boom", "Hit"] },
  { categorySlug: "sound-effects", name: "UI & Click", path: "UI & Click", order: 2, children: [] },
  { categorySlug: "sound-effects", name: "Ambient", path: "Ambient", order: 3, children: [] },
  // Music
  { categorySlug: "music", name: "Background", path: "Background", order: 0, children: ["Chill", "Upbeat", "Cinematic"] },
  { categorySlug: "music", name: "Intro/Outro", path: "Intro-Outro", order: 1, children: [] },
  // Video Meme
  { categorySlug: "video-meme", name: "Reaction", path: "Reaction", order: 0, children: [] },
  { categorySlug: "video-meme", name: "Trending", path: "Trending", order: 1, children: [] },
];

const DEMO_RESOURCES = [
  { name: "Whoosh Fast", category: "sound-effects", folder: "Transition", fileFormat: "mp3", fileSize: 145000, tags: ["transition", "whoosh", "fast"], slug: "whoosh-fast" },
  { name: "Swoosh Smooth", category: "sound-effects", folder: "Transition", fileFormat: "wav", fileSize: 320000, tags: ["transition", "swoosh"], slug: "swoosh-smooth" },
  { name: "Glitch Digital", category: "sound-effects", folder: "Transition", fileFormat: "mp3", fileSize: 98000, tags: ["glitch", "digital", "transition"], slug: "glitch-digital" },
  { name: "Boom Deep", category: "sound-effects", folder: "Impact", fileFormat: "wav", fileSize: 480000, tags: ["impact", "boom", "deep"], slug: "boom-deep" },
  { name: "Hit Punch", category: "sound-effects", folder: "Impact", fileFormat: "mp3", fileSize: 120000, tags: ["impact", "hit", "punch"], slug: "hit-punch" },
  { name: "Click UI", category: "sound-effects", folder: "UI & Click", fileFormat: "ogg", fileSize: 15000, tags: ["ui", "click", "button"], slug: "click-ui" },
  { name: "Notification Pop", category: "sound-effects", folder: "UI & Click", fileFormat: "mp3", fileSize: 28000, tags: ["notification", "pop", "ui"], slug: "notification-pop" },
  { name: "Rain Ambient", category: "sound-effects", folder: "Ambient", fileFormat: "mp3", fileSize: 2100000, tags: ["ambient", "rain", "nature"], slug: "rain-ambient" },
  { name: "Chill Lofi Beat", category: "music", folder: "Background", fileFormat: "mp3", fileSize: 4500000, tags: ["lofi", "chill", "background"], slug: "chill-lofi-beat" },
  { name: "Upbeat Energy", category: "music", folder: "Background", fileFormat: "mp3", fileSize: 3800000, tags: ["upbeat", "energy", "positive"], slug: "upbeat-energy" },
  { name: "Cinematic Epic", category: "music", folder: "Background", fileFormat: "wav", fileSize: 8900000, tags: ["cinematic", "epic", "trailer"], slug: "cinematic-epic" },
  { name: "Short Intro Jingle", category: "music", folder: "Intro-Outro", fileFormat: "mp3", fileSize: 680000, tags: ["intro", "jingle", "short"], slug: "short-intro-jingle" },
  { name: "Sad Cat Meme", category: "video-meme", folder: "Reaction", fileFormat: "mp4", fileSize: 1200000, tags: ["cat", "sad", "reaction"], slug: "sad-cat-meme" },
  { name: "Surprised Pikachu", category: "video-meme", folder: "Reaction", fileFormat: "mp4", fileSize: 890000, tags: ["pikachu", "surprised", "reaction"], slug: "surprised-pikachu" },
  { name: "Sigma Walk", category: "video-meme", folder: "Trending", fileFormat: "mp4", fileSize: 2300000, tags: ["sigma", "walk", "trending"], slug: "sigma-walk" },
];

export async function POST() {
  return runSeed();
}

export async function GET() {
  return runSeed();
}

async function runSeed() {
  try {
    const results = { categories: 0, folders: 0, resources: 0, settings: false };

    // Seed categories
    for (const cat of CATEGORIES) {
      await setDoc(doc(db, "categories", cat.slug), {
        ...cat,
        resourceCount: 0,
        createdAt: serverTimestamp(),
      });
      results.categories++;
    }

    // Seed folders
    for (const folder of FOLDERS) {
      const folderId = `${folder.categorySlug}-${folder.path}`.replace(/[^a-zA-Z0-9-]/g, "-");
      await setDoc(doc(db, "folders", folderId), {
        categorySlug: folder.categorySlug,
        name: folder.name,
        path: folder.path,
        order: folder.order,
        resourceCount: 0,
        children: folder.children.map((childName) => ({
          name: childName,
          path: `${folder.path}/${childName}`,
          resourceCount: 0,
        })),
      });
      results.folders++;
    }

    // Seed resources
    for (const res of DEMO_RESOURCES) {
      const resId = res.slug;
      await setDoc(doc(db, "resources", resId), {
        ...res,
        fileUrl: "", // No actual file yet
        thumbnailUrl: "",
        previewUrl: "",
        downloadCount: Math.floor(Math.random() * 2000),
        isPublished: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      results.resources++;
    }

    // Seed settings
    await setDoc(doc(db, "settings", "general"), {
      siteName: "EditerLor",
      tagline: "Free Resources for Video Editors",
      seoDescription: "Download free sound effects, music, video memes, green screens, animations, overlays, fonts, and presets.",
      contactEmail: "",
      updatedAt: serverTimestamp(),
    });
    results.settings = true;

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
