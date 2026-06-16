"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Search, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth-context";
import PackCard from "./components/PackCard";
import styles from "./page.module.css";

// Animation configs
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } },
};

export default function ShopClient({ initialPacks }) {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState("popular");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [purchasedPackIds, setPurchasedPackIds] = useState([]);

  // Client-side fallback: if server returned empty (ISR cache miss), fetch via API
  const { data: clientPacks } = useSWR(
    initialPacks.length === 0 ? "shop_packs_fallback" : null,
    async () => {
      const res = await fetch("/api/shop/packs?limit=50");
      if (!res.ok) return [];
      const { packs } = await res.json();
      return packs || [];
    }
  );

  const packs = initialPacks.length > 0 ? initialPacks : (clientPacks || []);

  // Fetch categories
  const { data: categories = [] } = useSWR("shop_categories", async () => {
    const { data } = await supabase
      .from("categories")
      .select("slug, name")
      .order("name");
    return data || [];
  });

  // Fetch user purchases to show "Owned" badges
  useEffect(() => {
    if (user) {
      async function fetchPurchases() {
        const { data, error } = await supabase
          .from("pack_purchases")
          .select("pack_id")
          .eq("user_id", user.id)
          .eq("status", "completed");

        if (!error && data) {
          setPurchasedPackIds(data.map((p) => p.pack_id));
        }
      }
      fetchPurchases();
    } else {
      setPurchasedPackIds([]);
    }
  }, [user]);

  // Client side filtering & sorting
  const filteredPacks = packs
    .filter((pack) => {
      // 1. Search term match
      const matchesSearch =
        pack.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pack.short_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (pack.tags && pack.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase())));

      // 2. Category match
      const matchesCategory =
        categoryFilter === "all" || pack.category_id === categoryFilter;

      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      // 3. Sorting
      if (sort === "newest") {
        return new Date(b.created_at) - new Date(a.created_at);
      }
      if (sort === "price_asc") {
        return a.price - b.price;
      }
      if (sort === "price_desc") {
        return b.price - a.price;
      }
      // "popular" (purchase_count desc)
      return (b.purchase_count || 0) - (a.purchase_count || 0);
    });

  return (
    <div className={styles.container}>
      {/* HERO SECTION */}
      <section className={styles.hero}>
        <h1 className={styles.title}>SOUND PACKS</h1>
        <p className={styles.subtitle}>
          Curated bundles of premium sound effects, transitions, and audio elements.
          One-time purchase for lifetime commercial use. Free for Premium members.
        </p>
      </section>

      {/* FILTER BAR */}
      <section className={styles.filterBar}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search sound packs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <select
            className={styles.sortSelect}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>

          <select
            className={styles.sortSelect}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="popular">Most Popular</option>
            <option value="newest">Newest First</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
      </section>

      {/* GRID */}
      {filteredPacks.length === 0 ? (
        <div className={styles.noResults}>
          No sound packs found matching your filters.
        </div>
      ) : (
        <motion.div
          className={styles.grid}
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {filteredPacks.map((pack) => (
            <motion.div key={pack.id} variants={itemVariants}>
              <PackCard
                pack={pack}
                isPurchased={purchasedPackIds.includes(pack.id)}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
