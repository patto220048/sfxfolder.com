"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/app/components/layout/Navbar";
import Footer from "@/app/components/layout/Footer";
import ContextSearch from "@/app/components/ui/ContextSearch";

export default function LayoutShell({ children, initialCategories = [] }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  return (
    <>
      {!isAdmin && <Navbar initialCategories={initialCategories} />}
      <main style={!isAdmin ? { paddingTop: "var(--navbar-height)" } : undefined}>
        {children}
      </main>
      {!isAdmin && <Footer />}
      {!isAdmin && <ContextSearch />}
    </>
  );
}
