"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PackCard from "@/app/shop/components/PackCard";
import styles from "./page.module.css";

export default function FeaturedPacks() {
  const [packs, setPacks] = useState([]);

  useEffect(() => {
    async function fetchFeatured() {
      try {
        const res = await fetch("/api/shop/packs?sort=popular&limit=3");
        if (!res.ok) return;
        const { packs: data } = await res.json();
        // Filter featured or just take top 3
        setPacks(data || []);
      } catch (e) {
        console.error("Failed to fetch featured packs:", e);
      }
    }
    fetchFeatured();
  }, []);

  if (packs.length === 0) return null;

  return (
    <section className={styles.categories} id="featured-packs-section" style={{ paddingBottom: 0 }}>
      <div className={styles.categoryHeader}>
        <h2 className={styles.sectionTitle}>🔥 Premium Sound Packs</h2>
        <Link href="/shop" className={styles.browseAllLink}>
          Browse All Packs &rarr;
        </Link>
      </div>
      <div className={styles.packsGrid}>
        {packs.map((pack) => (
          <PackCard key={pack.id} pack={pack} isPurchased={false} />
        ))}
      </div>
    </section>
  );
}
