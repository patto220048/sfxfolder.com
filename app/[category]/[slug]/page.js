import { getResources, getResourceBySlug, REVALIDATE_TIME, mapResource } from "@/app/lib/api";
import { supabase } from "@/app/lib/supabase";
import { unstable_cache } from "next/cache";
import ResourceDetail from "./ResourceDetail";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sfxfolder.com";

/**
 * Fetch a single published resource by its slug, with full detail.
 * Uses category_id (which stores the category slug) to scope the query.
 */
async function getPublishedResource(categorySlug, resourceSlug) {
  const { data, error } = await supabase
    .from("resources")
    .select(
      "id, name, description, slug, category_id, folder_id, file_format, file_size, file_name, file_type, tags, download_url, preview_url, thumbnail_url, download_count, is_premium, is_published, created_at, updated_at, categories(slug, name, icon, color), folders(name)"
    )
    .eq("slug", resourceSlug)
    .eq("category_id", categorySlug)
    .eq("is_published", true)
    .maybeSingle();

  if (error || !data) return null;

  return mapResource(data);
}

const getCachedResource = unstable_cache(
  async (categorySlug, resourceSlug) =>
    getPublishedResource(categorySlug, resourceSlug),
  ["resource-detail"],
  { revalidate: REVALIDATE_TIME || 3600, tags: ["resources"] }
);

/**
 * Fetch related resources from the same category (excluding current).
 */
async function getRelatedResources(categorySlug, currentId) {
  const all = await getResources({
    categorySlug,
    limit: 9,
  });
  return all.filter((r) => r.id !== currentId).slice(0, 6);
}

/**
 * Dynamic metadata for individual resource pages — critical for SEO.
 */
export async function generateMetadata({ params }) {
  const { category, slug } = await params;
  const resource = await getCachedResource(category, slug);

  if (!resource) {
    return {
      title: "Resource Not Found",
      description: "The requested resource could not be found.",
    };
  }

  const categoryName =
    resource.category?.name || category.replace(/-/g, " ");
  const displayName = (resource.name || resource.fileName || "Untitled").replace(
    /\.[^/.]+$/,
    ""
  );
  const format = resource.fileFormat?.toUpperCase() || "";

  const title = `${displayName} — Free ${categoryName} Download`;
  const description = resource.description
    ? resource.description.slice(0, 160)
    : `Download ${displayName} (${format}) for free. High-quality ${categoryName.toLowerCase()} asset for video editing. No copyright, instant download on SFXFolder.`;

  const keywords = [
    displayName.toLowerCase(),
    `free ${categoryName.toLowerCase()}`,
    `${displayName.toLowerCase()} download`,
    `${displayName.toLowerCase()} free`,
    `${categoryName.toLowerCase()} for video editing`,
    ...(resource.tags || []).slice(0, 5),
  ];

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${SITE_URL}/${category}/${slug}`,
      siteName: "SFXFolder",
      ...(resource.thumbnailUrl && {
        images: [
          {
            url: resource.thumbnailUrl,
            alt: displayName,
          },
        ],
      }),
    },
    twitter: {
      card: resource.thumbnailUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(resource.thumbnailUrl && {
        images: [resource.thumbnailUrl],
      }),
    },
    alternates: {
      canonical: `${SITE_URL}/${category}/${slug}`,
    },
  };
}

export default async function ResourcePage({ params }) {
  const { category, slug } = await params;
  const resource = await getCachedResource(category, slug);

  if (!resource) {
    return (
      <div style={{ padding: "120px 20px 80px", textAlign: "center", minHeight: "60vh" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Resource Not Found</h1>
        <p style={{ color: "var(--text-muted)", marginTop: "12px" }}>
          The resource you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <a
          href={`/${category}`}
          style={{
            display: "inline-block",
            marginTop: "24px",
            color: "var(--text-primary)",
            textDecoration: "underline",
          }}
        >
          ← Back to {category.replace(/-/g, " ")}
        </a>
      </div>
    );
  }

  const related = await getRelatedResources(category, resource.id);
  const categoryName = resource.category?.name || category.replace(/-/g, " ");
  const categoryColor = resource.category?.color || "#FFFFFF";

  const displayName = (resource.name || "Untitled").replace(/\.[^/.]+$/, "");

  // JSON-LD: CreativeWork schema
  const resourceSchema = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: displayName,
    description:
      resource.description ||
      `Free ${categoryName} asset for video editing — ${displayName}`,
    url: `${SITE_URL}/${category}/${slug}`,
    datePublished: resource.createdAt,
    dateModified: resource.updatedAt || resource.createdAt,
    encodingFormat: resource.fileFormat,
    ...(resource.fileSize && {
      fileSize: `${(resource.fileSize / 1024).toFixed(0)} KB`,
    }),
    ...(resource.thumbnailUrl && {
      thumbnailUrl: resource.thumbnailUrl,
      image: resource.thumbnailUrl,
    }),
    keywords: (resource.tags || []).join(", "),
    isAccessibleForFree: !resource.isPremium,
    provider: {
      "@type": "Organization",
      name: "SFXFolder",
      url: SITE_URL,
    },
    isPartOf: {
      "@type": "CollectionPage",
      name: `Free ${categoryName}`,
      url: `${SITE_URL}/${category}`,
    },
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/DownloadAction",
      userInteractionCount: resource.downloadCount || 0,
    },
  };

  // BreadcrumbList schema
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
        item: `${SITE_URL}/${category}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: displayName,
        item: `${SITE_URL}/${category}/${slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(resourceSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <ResourceDetail
        resource={resource}
        related={related}
        categorySlug={category}
        categoryName={categoryName}
        categoryColor={categoryColor}
      />
    </>
  );
}
