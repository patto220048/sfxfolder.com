"use client";

import { useEffect } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { Suspense } from "react";
import { mediaManager } from "@/app/lib/mediaManager";
import Navbar from "@/app/components/layout/Navbar";
import Footer from "@/app/components/layout/Footer";
import ContextSearch from "@/app/components/ui/ContextSearch";

function LayoutContent({ children, initialCategories }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAdmin = pathname?.startsWith("/admin");
  const isPlugin = searchParams?.get("mode") === "plugin" || pathname?.startsWith("/plugins/") || (typeof window !== 'undefined' && window.location.search.includes('mode=plugin'));

  // Stop all media when route changes to prevent "ghost" audio playing on other pages
  useEffect(() => {
    mediaManager.stopAll();
  }, [pathname]);

  return (
    <div className={isPlugin ? 'is-plugin' : ''}>
      {!isAdmin && !isPlugin && <Navbar initialCategories={initialCategories} isPlugin={isPlugin} />}
      <main 
        style={{ 
          position: 'relative',
          paddingTop: "var(--navbar-height)"
        }}
      >
        {children}
      </main>
      {!isAdmin && !isPlugin && pathname !== "/about-us" && <Footer />}
      {!isAdmin && !isPlugin && pathname !== "/about-us" && <ContextSearch />}
    </div>
  );
}

export default function LayoutShell({ children, initialCategories = [] }) {
  return (
    <Suspense fallback={null}>
      <LayoutContent initialCategories={initialCategories}>{children}</LayoutContent>
    </Suspense>
  );
}

