import { getFolders, getResources, getCategoryBySlug, getCategories, REVALIDATE_TIME } from "@/app/lib/api";
import ClientPage from "./ClientPage";
import { unstable_cache } from "next/cache";
import { Suspense } from "react";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sfxfolder.com';

/**
 * SEO keyword map per category slug for targeted, keyword-rich metadata.
 */
const CATEGORY_SEO = {
  "sound-effects": {
    titlePrefix: "Free Sound Effects",
    keywords: ["free sound effects", "sfx free download", "royalty free sfx", "sound effects for video editing", "no copyright sound effects"],
    descriptionTemplate: (name, count) =>
      `Download ${count ? count + '+ ' : ''}free ${name.toLowerCase()} for video editing, YouTube, and TikTok. High-quality royalty-free SFX — no copyright issues. Instant download.`,
  },
  "music": {
    titlePrefix: "Free Music",
    keywords: ["free music for videos", "royalty free music", "no copyright music", "free background music", "music for youtube videos"],
    descriptionTemplate: (name, count) =>
      `Download ${count ? count + '+ ' : ''}free royalty-free music tracks for your videos. Perfect for YouTube, TikTok, and professional projects. No copyright issues.`,
  },
  "video-meme": {
    titlePrefix: "Free Video Memes",
    keywords: ["free meme videos", "meme clips download", "free meme sound effects", "viral meme assets", "video meme templates"],
    descriptionTemplate: (name, count) =>
      `Download ${count ? count + '+ ' : ''}free meme video clips and sound effects. Trending meme assets for content creation and social media.`,
  },
  "green-screen": {
    titlePrefix: "Free Green Screen Effects",
    keywords: ["free green screen effects", "chroma key assets", "green screen download", "free vfx green screen", "green screen overlays"],
    descriptionTemplate: (name, count) =>
      `Download ${count ? count + '+ ' : ''}free green screen effects and chroma key assets. Professional VFX overlays for video editing.`,
  },
  "animation": {
    titlePrefix: "Free Animations",
    keywords: ["free animations download", "motion graphics free", "free video animations", "animated overlays", "free motion templates"],
    descriptionTemplate: (name, count) =>
      `Download ${count ? count + '+ ' : ''}free animations and motion graphics. Professional animated overlays and templates for video editing.`,
  },
  "image-overlay": {
    titlePrefix: "Free Image Overlays",
    keywords: ["free image overlays", "video overlay effects", "free overlay download", "transparent overlays", "photo overlays free"],
    descriptionTemplate: (name, count) =>
      `Download ${count ? count + '+ ' : ''}free image overlays and visual effects. Transparent PNG overlays and effects for video editing.`,
  },
  "font": {
    titlePrefix: "Free Fonts",
    keywords: ["free fonts download", "free fonts for video editing", "professional typefaces free", "creative fonts", "free commercial fonts"],
    descriptionTemplate: (name, count) =>
      `Download ${count ? count + '+ ' : ''}free professional fonts and typefaces for your creative projects and video editing.`,
  },
  "preset-lut": {
    titlePrefix: "Free Presets & LUTs",
    keywords: ["free luts download", "free color grading presets", "video editing presets", "free lut pack", "color correction luts"],
    descriptionTemplate: (name, count) =>
      `Download ${count ? count + '+ ' : ''}free LUTs and color grading presets. Professional color correction tools for video editing.`,
  },
};

/**
 * Dynamic metadata generation for SEO-optimized category pages.
 */
export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams.category;

  let info = null;
  try {
    info = await getCategoryBySlug(slug);
  } catch (e) {
    // Fallback handled below
  }

  const categoryName = info?.name || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const seo = CATEGORY_SEO[slug];
  
  const title = seo 
    ? `${seo.titlePrefix} — Download Free ${categoryName} | SFXFolder`
    : `Free ${categoryName} — Download Free Assets | SFXFolder`;

  const description = seo
    ? seo.descriptionTemplate(categoryName, info?.resourceCount)
    : `Download free ${categoryName.toLowerCase()} for video editing. High-quality assets, instant download, no copyright issues.`;

  const keywords = seo?.keywords || [
    `free ${categoryName.toLowerCase()}`,
    `${categoryName.toLowerCase()} download`,
    `free ${categoryName.toLowerCase()} for video editing`,
  ];

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${SITE_URL}/${slug}`,
      siteName: "SFXFolder",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: `${SITE_URL}/${slug}`,
    },
  };
}

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

async function getCachedCategoryData(slug, tags = [], formats = []) {
  return unstable_cache(
    async () => {
      // 1. Fetch category info
      const info = await getCategoryBySlug(slug);

      // 2. Fetch folders for this category
      const fetchedFolders = await getFolders(slug);
      
      // 3. Fetch resources for this category with filters
      const fetchedResources = await getResources({ 
        categorySlug: slug, 
        selectedTags: tags, 
        selectedFormats: formats,
        limit: 200 
      });

      return {
        categoryInfo: info,
        flatFolders: fetchedFolders,
        allResources: fetchedResources
      };
    },
    ['category-data', slug, tags.join(','), formats.join(',')], 
    { 
      revalidate: REVALIDATE_TIME, 
      tags: ['resources', 'categories'] 
    }
  )();
}

export default async function CategoryPage({ params, searchParams }) {
  // Await params and searchParams for Next.js 15+ constraints
  const [resolvedParams, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const slug = resolvedParams.category;

  const urlTags = resolvedSearchParams.tags ? resolvedSearchParams.tags.split(",") : [];
  const urlFormats = resolvedSearchParams.format ? resolvedSearchParams.format.split(",") : [];

  let info = null;
  let flatFolders = [];
  let allResources = [];

  try {
    const data = await getCachedCategoryData(slug, urlTags, urlFormats);
    info = data.categoryInfo;
    flatFolders = data.flatFolders;
    allResources = data.allResources;
  } catch (e) {
    console.error("Fetch error in category page:", e.message);
  }

  if (!info) {
    // Fallback if not in DB
    info = { name: slug, color: "#FFFFFF", formats: [], layout: "media" };
  }

  const folderTree = buildFolderTree(flatFolders);

  // JSON-LD: CollectionPage schema for category
  const categoryName = info.name || slug;
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Free ${categoryName} — SFXFolder`,
    description: `Browse and download free ${categoryName.toLowerCase()} for video editing.`,
    url: `${SITE_URL}/${slug}`,
    isPartOf: {
      "@type": "WebSite",
      name: "SFXFolder",
      url: SITE_URL,
    },
    numberOfItems: allResources.length,
    mainEntity: {
      "@type": "ItemList",
      name: `${categoryName} Resources`,
      numberOfItems: allResources.length,
      itemListElement: allResources.slice(0, 50).map((res, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: res.name,
        url: res.slug ? `${SITE_URL}/${slug}/${res.slug}` : `${SITE_URL}/${slug}`,
      })),
    },
  };

  return (
    <Suspense fallback={<div>Loading category...</div>}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(collectionSchema),
        }}
      />
      <ClientPage 
        slug={slug} 
        info={info} 
        folders={folderTree} 
        resources={allResources} 
      />
    </Suspense>
  );
}

// Pre-render known categories at build time
export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((cat) => ({
    category: cat.slug,
  }));
}
