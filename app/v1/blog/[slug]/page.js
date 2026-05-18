import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getBlogPostBySlug } from "@/app/lib/api";
import styles from "./page.module.css";
import { Calendar, Clock, ArrowLeft, Share2, Link as LinkIcon, Download } from "lucide-react";
import { marked } from "marked";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sfxfolder.com';

// Generate dynamic metadata for SEO
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

  if (!post) {
    return {
      title: "Article Not Found | SFXFolder",
    };
  }

  const title = post.meta_title || `${post.title} | SFXFolder Blog`;
  const description = post.meta_description || post.summary || `Read ${post.title} on SFXFolder Blog to level up your video editing skills.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/v1/blog/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/v1/blog/${slug}`,
      type: "article",
      publishedTime: post.created_at,
      modifiedTime: post.updated_at,
      images: post.cover_image ? [{ url: post.cover_image, alt: post.title }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: post.cover_image ? [post.cover_image] : [],
    },
  };
}

// Calculate approximate reading time
function getReadingTime(text) {
  const wordsPerMinute = 225;
  const numberOfWords = text ? text.split(/\s/g).length : 0;
  return Math.max(1, Math.ceil(numberOfWords / wordsPerMinute));
}

export default async function BlogPostDetailPage({ params }) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const readingTime = getReadingTime(post.content || "");
  const formattedDate = new Date(post.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Convert markdown to html on the server
  const htmlContent = marked.parse(post.content || "");

  // BlogPosting JSON-LD Schema
  const blogPostingSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "image": post.cover_image ? [post.cover_image] : [],
    "datePublished": post.created_at,
    "dateModified": post.updated_at,
    "description": post.summary || post.meta_description,
    "author": {
      "@type": "Organization",
      "name": "SFXFolder",
      "url": SITE_URL
    },
    "publisher": {
      "@type": "Organization",
      "name": "SFXFolder",
      "logo": {
        "@type": "ImageObject",
        "url": `${SITE_URL}/favicon.webp?v=3`
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${SITE_URL}/v1/blog/${slug}`
    }
  };

  return (
    <div className={styles.detailLayout}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(blogPostingSchema),
        }}
      />

      <div className={styles.page}>
        {/* Back Link */}
        <div className={styles.backNav}>
          <Link href="/v1/blog" className={styles.backLink}>
            <ArrowLeft size={16} /> Back to Blog
          </Link>
        </div>

        {/* Article Header */}
        <header className={styles.articleHeader}>
          <div className={styles.metaRow}>
            <span className={styles.metaItem}>
              <Calendar size={14} className={styles.metaIcon} />
              {formattedDate}
            </span>
            <span className={styles.metaItem}>
              <Clock size={14} className={styles.metaIcon} />
              {readingTime} min read
            </span>
          </div>

          <h1 className={styles.title}>{post.title}</h1>
          {post.summary && <p className={styles.summary}>{post.summary}</p>}
        </header>

        {/* Cover Image */}
        {post.cover_image && (
          <div className={styles.coverImageWrap}>
            <Image
              src={post.cover_image}
              alt={post.title}
              fill
              className={styles.coverImage}
              priority
            />
          </div>
        )}

        {/* Main Content & Share Panel Layout */}
        <div className={styles.bodyWrap}>
          {/* Article Body */}
          <article className={styles.articleBody}>
            <div 
              className={styles.markdownContent}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
            
            {/* Conversion CTA Box inside the article body */}
            <div className={styles.ctaBox}>
              <div className={styles.ctaGlow} />
              <div className={styles.ctaHeader}>
                <Download size={24} className={styles.ctaIcon} />
                <h3>Need Assets for Your Edits?</h3>
              </div>
              <p>
                SFXFolder offers high-quality, professional-grade sound effects, transitions, presets, LUTs, and royalty-free music completely for free. No copyright claims, no account required.
              </p>
              <div className={styles.ctaGrid}>
                <Link href="/sound-effects" className={styles.ctaBtn}>
                  Sound Effects
                </Link>
                <Link href="/preset-lut" className={styles.ctaBtn}>
                  Presets & LUTs
                </Link>
                <Link href="/music" className={styles.ctaBtn}>
                  Royalty-Free Music
                </Link>
              </div>
            </div>
          </article>

          {/* Sidebar / Sharing Actions */}
          <aside className={styles.shareSidebar}>
            <div className={styles.stickyPanel}>
              <h4 className={styles.sidebarTitle}>Share Article</h4>
              
              <div className={styles.shareButtons}>
                <a 
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(`${SITE_URL}/v1/blog/${slug}`)}&text=${encodeURIComponent(post.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.shareButton}
                  title="Share on X"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  <span>Share on X</span>
                </a>

                <a 
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${SITE_URL}/v1/blog/${slug}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.shareButton}
                  title="Share on Facebook"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z" />
                  </svg>
                  <span>Facebook</span>
                </a>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
