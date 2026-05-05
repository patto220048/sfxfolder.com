import React from "react";
import Link from "next/link";
import FAQItem from "./FAQItem";
import styles from "./page.module.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sfxfolder.com';

export const metadata = {
  title: "Q&A - Frequently Asked Questions | SFXFolder",
  description: "Find answers to common questions about SFXFolder resources, Premiere Pro plugin, commercial usage, and more.",
  openGraph: {
    title: "SFXFolder Q&A - Frequently Asked Questions",
    description: "Got questions about SFXFolder? We have answers. Learn about our free assets, commercial licensing, and plugin integration.",
    url: `${SITE_URL}/faq`,
    siteName: "SFXFolder",
    images: [
      {
        url: `${SITE_URL}/og-faq.jpg`,
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SFXFolder Q&A - Frequently Asked Questions",
    description: "Find answers to common questions about our high-quality sound effects and editing tools.",
    images: [`${SITE_URL}/og-faq.jpg`],
  },
};

const faqs = [
  {
    question: "Is SFXFolder really free?",
    answer: "Yes, 100%. All resources on SFXFolder are free to download and use in your projects. We believe in providing high-quality tools to the editor community without barriers."
  },
  {
    question: "Can I use these assets for commercial projects?",
    answer: "Absolutely. All assets are royalty-free and can be used for both personal and commercial projects, including YouTube videos, feature films, and commercial advertisements."
  },
  {
    question: "How do I install the Premiere Pro plugin?",
    answer: "You can download the installer from our homepage. Once installed, open Premiere Pro and navigate to Window > Extensions > SFXFolder to start using the plugin directly inside your project."
  },
  {
    question: "What audio formats are supported?",
    answer: "We primarily provide high-quality WAV files (24-bit/48kHz or higher) for maximum fidelity, as well as MP3 versions where appropriate for smaller file sizes."
  },
  {
    question: "Do I need to provide credit when using assets?",
    answer: "While not required, we always appreciate a shout-out or a link back to SFXFolder. It helps us grow and keep providing free resources for everyone."
  },
  {
    question: "Is there a download limit?",
    answer: "There are no hard limits on the number of resources you can download. However, we have automated systems to prevent bulk scraping to ensure the platform remains stable for everyone."
  }
];

export default function FAQPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  return (
    <div className={styles.container}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className={styles.hero}>
        <p className={styles.subtitle}>Help Center</p>
        <h1 className={styles.title}>Questions & Answers</h1>
      </header>

      <section className={styles.faqSection}>
        {faqs.map((faq, index) => (
          <FAQItem key={index} faq={faq} />
        ))}
      </section>

      <div className={styles.contactBanner}>
        <h2 className={styles.bannerTitle}>Still have questions?</h2>
        <p>Our team is here to help you with anything you need.</p>
        <Link href="/contact" className={styles.contactBtn}>
          Contact Support
        </Link>
      </div>
    </div>
  );
}
