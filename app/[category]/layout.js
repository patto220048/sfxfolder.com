import { getFolders, getCategoryBySlug } from "@/app/lib/api";
import { buildFolderTree } from "@/app/lib/folderUtils";
import Sidebar from "@/app/components/layout/Sidebar";
import styles from "./layout.module.css";
import { SidebarProvider } from "@/app/context/SidebarContext";


import CategoryStickyAd from "@/app/components/ads/CategoryStickyAd";

export default async function CategoryLayout({ children, params }) {
  const { category } = await params;
  
  const [info, rawFolders] = await Promise.all([
    getCategoryBySlug(category),
    getFolders(category)
  ]);

  const folders = buildFolderTree(rawFolders);
  const categoryName = info?.name || category.replace(/-/g, " ");
  const categoryColor = info?.color || "#FFFFFF";

  return (
    <SidebarProvider>
      <div className={styles.page}>
        <Sidebar 
          folders={folders} 
          categorySlug={category}
          categoryName={categoryName}
          primaryColor={categoryColor}
        />
        {children}
      </div>
      <CategoryStickyAd />
    </SidebarProvider>
  );
}

