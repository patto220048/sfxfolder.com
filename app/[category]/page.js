import { getFolders, getResources, getCategoryBySlug, getCategories } from "@/app/lib/api";
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
  async (slug) => {
    // 1. Fetch category info
    const info = await getCategoryBySlug(slug);

    // 2. Fetch folders for this category
    const fetchedFolders = await getFolders(slug);
    
    // 3. Fetch resources for this category
    const fetchedResources = await getResources({ categorySlug: slug, limit: 1000 });

    return {
      categoryInfo: info,
      flatFolders: fetchedFolders,
      allResources: fetchedResources
    };
  },
  ['category-data'],
  { 
    revalidate: 3600, 
    tags: ['resources', 'categories'] 
  }
);

export default async function CategoryPage({ params }) {
  // Await params to be compatible with Next.js 15+ constraints
  const resolvedParams = await params;
  const slug = resolvedParams.category;

  let info = null;
  let flatFolders = [];
  let allResources = [];

  try {
    const data = await getCachedCategoryData(slug);
    info = data.categoryInfo;
    flatFolders = data.flatFolders;
    allResources = data.allResources;
  } catch (e) {
    console.error("Fetch error in category page:", e.message);
  }

  if (!info) {
    // Fallback if not in DB
    info = { name: slug, color: "#00F0FF", formats: [], layout: "media" };
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
