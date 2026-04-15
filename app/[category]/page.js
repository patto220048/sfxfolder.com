import { getFolders, getResources } from "@/app/lib/api";
import ClientPage from "./ClientPage";
import { unstable_cache } from "next/cache";

const CATEGORY_INFO = {
  "sound-effects": { name: "Sound Effects", color: "#00F0FF", formats: ["mp3", "wav", "ogg"], layout: "sound" },
  music: { name: "Music", color: "#A855F7", formats: ["mp3", "wav", "flac"], layout: "sound" },
  "video-meme": { name: "Video Meme", color: "#FBBF24", formats: ["mp4", "webm", "gif"], layout: "media" },
  "green-screen": { name: "Green Screen", color: "#22C55E", formats: ["mp4", "mov", "webm"], layout: "media" },
  animation: { name: "Animation", color: "#F43F5E", formats: ["mp4", "gif", "webm"], layout: "media" },
  "image-overlay": { name: "Image & Overlay", color: "#F97316", formats: ["png", "jpg", "webp"], layout: "media" },
  font: { name: "Font", color: "#E2E8F0", formats: ["ttf", "otf", "woff2"], layout: "font" },
  "preset-lut": { name: "Preset & LUT", color: "#6366F1", formats: ["cube", "xmp", "lut"], layout: "media" },
};

function buildFolderTree(flatList) {
  const map = {};
  const roots = [];

  flatList.forEach((f) => {
    map[f.id] = { ...f, children: [], path: f.name };
  });

  flatList.forEach((f) => {
    if (f.parentId && map[f.parentId]) {
      const parent = map[f.parentId];
      map[f.id].path = `${parent.path}/${f.name}`;
      parent.children.push(map[f.id]);
    } else {
      roots.push(map[f.id]);
    }
  });

  const sortChildren = (nodes) => {
    nodes.sort((a, b) => (a.order || 0) - (b.order || 0));
    nodes.forEach((n) => {
      if (n.children.length > 0) sortChildren(n.children);
    });
  };
  sortChildren(roots);
  return roots;
}

const getCachedCategoryData = unstable_cache(
  async (slug) => {
    // 1. Fetch folders for this category
    const fetchedFolders = await getFolders(slug);
    
    // 2. Fetch resources for this category
    const fetchedResources = await getResources({ categorySlug: slug, limit: 1000 });

    return {
      flatFolders: fetchedFolders,
      allResources: fetchedResources
    };
  },
  ['category-data'],
  { 
    revalidate: 3600, 
    tags: ['resources'] 
  }
);

export default async function CategoryPage({ params }) {
  // Await params to be compatible with Next.js 15+ constraints
  const resolvedParams = await params;
  const slug = resolvedParams.category;
  const info = CATEGORY_INFO[slug] || { name: slug, color: "#00F0FF", formats: [], layout: "media" };

  let flatFolders = [];
  let allResources = [];

  try {
    const data = await getCachedCategoryData(slug);
    flatFolders = data.flatFolders;
    allResources = data.allResources;
  } catch (e) {
    console.error("Fetch error in category page:", e.message);
  }

  const folderTree = buildFolderTree(flatFolders);

  return (
    <ClientPage 
      slug={slug} 
      info={info} 
      folders={folderTree} 
      resources={allResources} 
    />
  );
}

// Pre-render known categories at build time
export async function generateStaticParams() {
  return Object.keys(CATEGORY_INFO).map((slug) => ({
    category: slug,
  }));
}
