import CategoryCard from "@/app/components/ui/CategoryCard";
import SearchBar from "@/app/components/ui/SearchBar";
import { getCategoriesWithCounts } from "@/app/lib/api";
import styles from "./page.module.css";

export default async function Home() {
  let categories = [];
  try {
    categories = await getCategoriesWithCounts();
  } catch (e) {
    // Fallback static data with Neobrutalist palette
    categories = [
      { slug: "sound-effects", name: "Sound Effects", icon: "volume-2", color: "#FFD93D", description: "High-quality SFX" },
      { slug: "music", name: "Music", icon: "music", color: "#FF6B6B", description: "Royalty-free tracks" },
      { slug: "video-meme", name: "Video Meme", icon: "film", color: "#6C5CE7", description: "Trending meme clips" },
      { slug: "green-screen", name: "Green Screen", icon: "monitor", color: "#1DD1A1", description: "Chroma key assets" },
      { slug: "animation", name: "Animation", icon: "sparkles", color: "#FF9F43", description: "Motion graphics" },
      { slug: "image-overlay", name: "Image & Overlay", icon: "image", color: "#A55EE1", description: "Visual overlays" },
      { slug: "font", name: "Font", icon: "type", color: "#00D2D3", description: "Professional typefaces" },
      { slug: "preset-lut", name: "Preset & LUT", icon: "sliders", color: "#54A0FF", description: "Color grading tools" },
    ];
  }

  return (
    <div className={styles.page}>
      {/* Hero Section */}
      <section className={styles.hero} id="hero-section">
        <div className={styles.heroGlow} />
        <h1 className={styles.title}>
          EditerLor
        </h1>
        <p className={styles.subtitle}>
          Digital Assets for Video Editors
        </p>
        <p className={styles.description}>
          A curated library of pro-grade sound effects, music, memes, and assets. 
          Stark design. High performance.
        </p>
        <div className={styles.searchWrap}>
          <SearchBar size="large" placeholder="Search resources..." />
        </div>
      </section>

      {/* Categories Grid */}
      <section className={styles.categories} id="categories-section">
        <h2 className={styles.sectionTitle}>Categories</h2>
        <div className={styles.grid}>
          {categories.map((cat, index) => (
            <CategoryCard
              key={cat.slug}
              name={cat.name}
              slug={cat.slug}
              icon={cat.icon}
              color={cat.color}
              description={cat.description}
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
          <span className={styles.statNumber}>Instant</span>
          <span className={styles.statLabel}>Download</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>100%</span>
          <span className={styles.statLabel}>Open Access</span>
        </div>
      </section>
    </div>
  );
}
