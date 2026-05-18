import { getFolders, getResources, getCategoryBySlug, getCategories, getCategoryTags, REVALIDATE_TIME } from "@/app/lib/api";
import { buildFolderTree } from "@/app/lib/folderUtils";

import ClientPage from "./ClientPage";
import { unstable_cache } from "next/cache";
import { Suspense } from "react";
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
 * FAQ list per category slug for targeted FAQ section and FAQPage schema.
 */
const CATEGORY_FAQS = {
  "sound-effects": [
    {
      q: "Are these sound effects completely free to use?",
      a: "Yes, all sound effects on SFXFolder are 100% free to download and use in both personal and commercial projects, including YouTube videos, TikToks, films, and game development."
    },
    {
      q: "What format are the sound effects downloaded in?",
      a: "Our sound effects are typically provided in high-quality professional audio formats like WAV (24-bit/48kHz or 16-bit/44.1kHz) or MP3 to ensure compatibility and maximum fidelity for video editing."
    },
    {
      q: "Will I get copyright strikes on YouTube for using these?",
      a: "You should not get any copyright strikes or claims on YouTube for using these sound effects, as they are royalty-free and copyright-safe. However, to be 100% sure, we recommend using a copyright claim service to check your videos before publishing."
    },
    {
      q: "Do I need to give attribution or credit to SFXFolder?",
      a: "While attribution is not legally required, it is highly appreciated! Sharing our link 'sfxfolder.com' in your video description helps us keep providing free assets for the community."
    }
  ],
  "music": [
    {
      q: "Is this background music copyright-safe?",
      a: "No, it is not. While we curate the best copyright-safe background music for creators, we cannot guarantee 100% copyright-free status for all tracks. We recommend using a copyright claim service to check your videos before publishing."
    },
    {
      q: "Can I use these tracks in monetized YouTube videos?",
      a: "We cannot provide legal advice or guarantees for any third-party content. Users are responsible for ensuring compliance with all applicable laws and platform policies."
    }
  ],
  "video-meme": [
    {
      q: "Are these meme video clips free to download?",
      a: "Yes! All trending video memes and green screen meme clips are completely free to download in high definition MP4 format for direct import into your video editor."
    },
    {
      q: "Can I use these meme clips in YouTube videos?",
      a: "Yes, meme video templates are widely used under fair use for commentary, parody, and entertainment. Our curated clips are fully optimized and safe for creators."
    }
  ],
  "green-screen": [
    {
      q: "How do I use these green screen effects in my editor?",
      a: "Simply download the MP4 file, import it into your editor (Premiere Pro, CapCut, DaVinci Resolve, or After Effects), apply the 'Ultra Key' or 'Chroma Key' effect, and select the green background color to make it transparent."
    },
    {
      q: "Are all VFX green screen assets royalty-free?",
      a: "Yes, all chroma key overlays, explosions, anime sparks, fire, and transitions on SFXFolder are 100% royalty-free and commercial-safe."
    }
  ],
  "animation": [
    {
      q: "What software can I use these motion graphic animations with?",
      a: "Our animations are exported as high-quality video files (mostly MP4 or transparent WebM/MOV) that work seamlessly with any editing software including Premiere Pro, CapCut, DaVinci, After Effects, and Final Cut."
    },
    {
      q: "Are these animated templates free for commercial projects?",
      a: "Yes, they are free for both commercial client projects and personal social media channels without any licensing fees."
    }
  ],
  "image-overlay": [
    {
      q: "What are image overlays and how do I apply them?",
      a: "Image overlays are visual layers (like dust, scratches, borders, or light leaks) that you place on top of your main video track. You can set their blending mode to 'Screen', 'Multiply', or 'Overlay' in your video editor to create stylish visual effects."
    },
    {
      q: "Are these overlay images transparent?",
      a: "Yes! Most overlays are provided either as transparent PNG files or high-contrast JPGs designed for blending modes."
    }
  ],
  "font": [
    {
      q: "Are these fonts free for commercial use?",
      a: "Yes, we curate professional fonts that are licensed for commercial use, so you can safely use them in client videos, advertisements, logos, and YouTube thumbnails."
    },
    {
      q: "How do I install these fonts in my video editing software?",
      a: "Download the font ZIP file, extract it, and install the .OTF or .TTF file on your Windows or Mac system. Your video editors (like Premiere Pro, Photoshop, or CapCut) will automatically detect the new font."
    }
  ],
  "preset-lut": [
    {
      q: "What is a LUT and how does it help color grading?",
      a: "A LUT (Look-Up Table) is a file containing color values that instantly transforms the colors of your video footage. It allows you to achieve cinematic color grading looks in one click."
    },
    {
      q: "Do these LUTs work in CapCut and Premiere Pro?",
      a: "Yes, our LUTs are provided in the universal `.cube` format, which is fully compatible with Adobe Premiere Pro, CapCut, DaVinci Resolve, After Effects, and Final Cut Pro."
    }
  ]
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
  const lookupSlug = slug === "lut" ? "preset-lut" : (slug === "bgm" ? "music" : slug);
  const seo = CATEGORY_SEO[lookupSlug];
  
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
        limit: 50 
      });

      // 4. Fetch all tags for this category
      const categoryTags = await getCategoryTags(slug);

      return {
        categoryInfo: info,
        flatFolders: fetchedFolders,
        allResources: fetchedResources,
        categoryTags
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
  let categoryTags = [];

  try {
    const data = await getCachedCategoryData(slug, urlTags, urlFormats);
    if (data) {
      info = data.categoryInfo;
      flatFolders = data.flatFolders;
      allResources = data.allResources;
      categoryTags = data.categoryTags;
    }
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

  // BreadcrumbList schema for better Google Search results (Sitelinks)
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: categoryName,
        item: `${SITE_URL}/${slug}`,
      },
    ],
  };

  // FAQPage Schema
  const lookupSlug = slug === "lut" ? "preset-lut" : (slug === "bgm" ? "music" : slug);
  const categoryFaqs = CATEGORY_FAQS[lookupSlug] || [];
  const faqSchema = categoryFaqs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": categoryFaqs.map(faq => ({
      "@type": "Question",
      "name": faq.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.a
      }
    }))
  } : null;

  return (
    <Suspense fallback={<div>Loading category...</div>}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(collectionSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema),
        }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(faqSchema),
          }}
        />
      )}
      <ClientPage 
        slug={slug} 
        info={info} 
        folders={folderTree} 
        resources={allResources} 
        categoryTags={categoryTags}
        faqs={categoryFaqs}
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
