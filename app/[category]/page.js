import { getFolders, getResources, getCategoryBySlug, getCategories, REVALIDATE_TIME } from "@/app/lib/api";
import ClientPage from "./ClientPage";
import { unstable_cache } from "next/cache";

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
  async (slug, tags = [], formats = []) => {
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
  ['category-data'], 
  { 
    revalidate: REVALIDATE_TIME, 
    tags: ['resources', 'categories'] 
  }
);

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
  const categories = await getCategories();
  return categories.map((cat) => ({
    category: cat.slug,
  }));
}
