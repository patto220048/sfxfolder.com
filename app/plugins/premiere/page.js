import { getFolders, getResources, getCategoryBySlug, getCategoryTags } from "@/app/lib/api";
import { buildFolderTree } from "@/app/lib/folderUtils";
import ClientPage from "@/app/[category]/ClientPage";
import Sidebar from "@/app/components/layout/Sidebar";
import { SidebarProvider } from "@/app/context/SidebarContext";
import { Suspense } from "react";
import styles from "@/app/[category]/layout.module.css";

export const dynamic = 'force-dynamic';

export default async function PremierePluginPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const slug = resolvedSearchParams?.category || "sound-effects"; // Default category for the plugin
  const query = resolvedSearchParams?.q || "";
  
  let info = null;
  let flatFolders = [];
  let allResources = [];
  let categoryTags = [];

  try {
    // Fetch data directly on the server
    [info, flatFolders, allResources, categoryTags] = await Promise.all([
      getCategoryBySlug(slug),
      getFolders(slug),
      getResources({ categorySlug: slug, q: query, limit: 50 }),
      getCategoryTags(slug)
    ]);
  } catch (e) {
    console.error("Fetch error in Premiere plugin page:", e.message);
  }

  if (!info) {
    info = { name: "Sound Effects", color: "#FFFFFF", formats: [], layout: "media" };
  }

  const folderTree = buildFolderTree(flatFolders);

  return (
    <SidebarProvider>
      <Suspense fallback={<div style={{ padding: '20px', color: '#666' }}>Loading Premiere Plugin...</div>}>
        <ClientPage 
          slug={slug} 
          info={info} 
          folders={folderTree} 
          resources={allResources} 
          categoryTags={categoryTags}
          isPlugin={true}
        />
      </Suspense>
    </SidebarProvider>
  );
}
