import { getCategories, getResources } from '@/app/lib/api';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sfxfolder.com';

export default async function sitemap() {
  // 1. Static pages
  const staticPages = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/search`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // 2. Dynamic category pages + resource pages
  let categoryPages = [];
  let resourcePages = [];

  try {
    const categories = await getCategories();
    categoryPages = categories.map((cat) => ({
      url: `${SITE_URL}/${cat.slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    }));

    // 3. Fetch resources for each category (limited to 200 per category for sitemap)
    const resourcePromises = categories.map(async (cat) => {
      try {
        const resources = await getResources({
          categorySlug: cat.slug,
          limit: 200,
        });
        return resources
          .filter((res) => res.slug)
          .map((res) => ({
            url: `${SITE_URL}/${cat.slug}/${res.slug}`,
            lastModified: res.updatedAt
              ? new Date(res.updatedAt)
              : res.createdAt
              ? new Date(res.createdAt)
              : new Date(),
            changeFrequency: 'weekly',
            priority: 0.7,
          }));
      } catch (e) {
        console.error(`Sitemap: Error fetching resources for ${cat.slug}:`, e.message);
        return [];
      }
    });

    const allResourceArrays = await Promise.all(resourcePromises);
    resourcePages = allResourceArrays.flat();
  } catch (e) {
    console.error('Sitemap: Error fetching categories:', e.message);
  }

  return [...staticPages, ...categoryPages, ...resourcePages];
}
