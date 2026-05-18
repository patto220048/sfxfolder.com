import Link from "next/link";
import Image from "next/image";
import { getBlogPosts } from "@/app/lib/api";
import styles from "./page.module.css";
import { BookOpen, Calendar, Clock, ArrowRight } from "lucide-react";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sfxfolder.com';

export const metadata = {
  title: "SFXFolder Blog — Video Editing & Sound Design Tips",
  description: "Improve your video editing workflow with hand-picked sound design tips, LUT grading guides, and video assets tutorials from professional industry experience.",
  alternates: {
    canonical: `${SITE_URL}/v1/blog`,
  },
  openGraph: {
    title: "SFXFolder Blog — Video Editing & Sound Design Tips",
    description: "Improve your video editing workflow with hand-picked sound design tips, LUT grading guides, and video assets tutorials from professional industry experience.",
    url: `${SITE_URL}/v1/blog`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SFXFolder Blog — Video Editing & Sound Design Tips",
    description: "Pro-grade editing and sound design guides.",
  },
};

// Calculate approximate reading time for display
function getReadingTime(text) {
  const wordsPerMinute = 225;
  const numberOfWords = text ? text.split(/\s/g).length : 0;
  return Math.max(1, Math.ceil(numberOfWords / wordsPerMinute));
}

export default async function BlogPage() {
  let posts = [];
  try {
    posts = await getBlogPosts({ limit: 20 });
  } catch (error) {
    console.error("Failed to load blog posts:", error);
  }

  // Schema structured markup for Blog
  const blogSchema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "SFXFolder Blog",
    "description": "Expert advice, guides, and tips for video editors and sound designers.",
    "url": `${SITE_URL}/v1/blog`,
    "publisher": {
      "@type": "Organization",
      "name": "SFXFolder",
      "logo": {
        "@type": "ImageObject",
        "url": `${SITE_URL}/favicon.webp?v=3`
      }
    }
  };

  return (
    <div className={styles.blogLayout}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(blogSchema),
        }}
      />

      <div className={styles.page}>
        {/* Hero Section */}
        <section className={styles.hero}>
          <div className={styles.heroGlow} />
          <h1 className={styles.title}>SFXFolder Blog</h1>
          <p className={styles.subtitle}>Simplify Your Creative Search</p>
          <p className={styles.description}>
            Curated insights, tutorials, and workflow optimizations written by industry professionals. 
            Level up your video editing, color grading, and sound design.
          </p>
        </section>

        {/* Content Section */}
        <section className={styles.postsSection}>
          {posts.length > 0 ? (
            <div className={styles.grid}>
              {posts.map((post) => {
                const readingTime = getReadingTime(post.content || post.summary || "");
                const formattedDate = new Date(post.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                });

                return (
                  <article key={post.id} className={styles.postCard} id={`blog-card-${post.slug}`}>
                    <Link href={`/v1/blog/${post.slug}`} className={styles.cardLink}>
                      {post.cover_image && (
                        <div className={styles.imageWrap}>
                          <Image
                            src={post.cover_image}
                            alt={post.title}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className={styles.coverImage}
                            priority={false}
                          />
                        </div>
                      )}
                      
                      <div className={styles.cardContent}>
                        <div className={styles.metaRow}>
                          <span className={styles.metaItem}>
                            <Calendar size={12} className={styles.metaIcon} />
                            {formattedDate}
                          </span>
                          <span className={styles.metaItem}>
                            <Clock size={12} className={styles.metaIcon} />
                            {readingTime} min read
                          </span>
                        </div>

                        <h2 className={styles.postTitle}>{post.title}</h2>
                        
                        {post.summary && <p className={styles.postSummary}>{post.summary}</p>}

                        <span className={styles.readMore}>
                          Read Article <ArrowRight size={14} className={styles.arrowIcon} />
                        </span>
                      </div>
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIconWrap}>
                <BookOpen size={48} strokeWidth={1.5} className={styles.emptyIcon} />
              </div>
              <h2 className={styles.emptyTitle}>Premium Articles Coming Soon</h2>
              <p className={styles.emptyText}>
                We are currently crafting high-quality, pro-grade articles to streamline your video editing and sound design workflow. 
                Subscribe or bookmark this page to stay updated!
              </p>
              <div className={styles.ctaWrap}>
                <Link href="/" className={styles.backHomeBtn}>
                  Browse Free SFX Folder
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
