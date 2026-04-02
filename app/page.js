import CategoryCard from "@/app/components/ui/CategoryCard";
import SearchBar from "@/app/components/ui/SearchBar";
import { getCategories } from "@/app/lib/firestore";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function Home() {
  let categories = [];
  try {
    categories = await getCategories();
  } catch (e) {
    console.error("Failed to load categories:", e.message);
    // Fallback static data
    categories = [
      { slug: "sound-effects", name: "Sound Effects", icon: "volume-2", color: "#00F0FF" },
      { slug: "music", name: "Music", icon: "music", color: "#A855F7" },
      { slug: "video-meme", name: "Video Meme", icon: "film", color: "#FBBF24" },
      { slug: "green-screen", name: "Green Screen", icon: "monitor", color: "#22C55E" },
      { slug: "animation", name: "Animation", icon: "sparkles", color: "#F43F5E" },
      { slug: "image-overlay", name: "Image & Overlay", icon: "image", color: "#F97316" },
      { slug: "font", name: "Font", icon: "type", color: "#E2E8F0" },
      { slug: "preset-lut", name: "Preset & LUT", icon: "sliders", color: "#6366F1" },
    ];
  }

  return (
    <div className={styles.page}>
      {/* Hero Section */}
      <section className={styles.hero} id="hero-section">
        <div className={styles.heroGlow} />
        <h1 className={styles.title}>
          <span className={styles.glitch} data-text="EditerLor">
            EditerLor
          </span>
        </h1>
        <p className={styles.subtitle}>
          Free Resources for Video Editors
        </p>
        <p className={styles.description}>
          Download sound effects, music, video memes, green screens, animations,
          overlays, fonts, and presets — all for free.
        </p>
        <div className={styles.searchWrap}>
          <SearchBar size="large" placeholder="Search sound effects, music, memes..." />
        </div>
        <p className={styles.tip}>
          💡 Pro tip: <strong>Right-click</strong> anywhere for quick search
        </p>
      </section>

      {/* Categories Grid */}
      <section className={styles.categories} id="categories-section">
        <h2 className={styles.sectionTitle}>Browse Categories</h2>
        <div className={styles.grid}>
          {categories.map((cat, index) => (
            <CategoryCard
              key={cat.slug}
              name={cat.name}
              slug={cat.slug}
              icon={cat.icon}
              color={cat.color}
              resourceCount={cat.resourceCount}
              index={index}
            />
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className={styles.stats} id="stats-section">
        <div className={styles.statItem}>
          <span className={styles.statNumber}>{categories.length}</span>
          <span className={styles.statLabel}>Categories</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>1-Click</span>
          <span className={styles.statLabel}>Download</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>100%</span>
          <span className={styles.statLabel}>Free</span>
        </div>
      </section>
    </div>
  );
}
