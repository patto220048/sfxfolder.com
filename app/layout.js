import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from "@/app/components/providers/ThemeProvider";
import "./globals.css";
import "./animations.css";
import LayoutShell from "@/app/components/layout/LayoutShell";
import { getCategories, getSiteSettings } from "@/app/lib/api";
import { ToastProvider } from "@/app/context/ToastContext";
import { ToastContainer } from "@/app/components/ui/ToastContainer";
import { SiteProvider } from "@/app/context/SiteContext";
import { AuthProvider } from "@/app/lib/auth-context";
import { FavoritesProvider } from "@/app/context/FavoritesContext";
import { GoogleAnalytics } from '@next/third-parties/google';

import Script from "next/script";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import SmoothScroll from "@/app/components/layout/SmoothScroll";
import ClientGlobalAds from "@/app/components/ads/ClientGlobalAds";
import EzoicRouteHandler from "@/app/components/ads/EzoicRouteHandler";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sfxfolder.com';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Free Sound Effects & Video Assets Download — SFXFolder",
    template: "%s | SFXFolder",
  },
  description:
    "Download free sound effects, music, LUTs, green screen & more for video editing. 500+ curated assets — instant download, no copyright issues.",
  keywords: [
    "free sound effects",
    "sfx free",
    "free sfx download",
    "royalty free sound effects",
    "sound effects for video editing",
    "free music for videos",
    "video meme sounds",
    "green screen effects",
    "free video editing assets",
    "no copyright sound effects",
    "free sfx for youtube",
    "download sfx free",
  ],
  icons: {
    icon: [
      { url: "/favicon.webp?v=3" },
    ],
    apple: "/favicon.webp?v=3",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Free Sound Effects & Video Assets — SFXFolder",
    description:
      "Download free sound effects, music, LUTs & more for video editing. Curated assets with instant download.",
    type: "website",
    url: SITE_URL,
    siteName: "SFXFolder",
    locale: "en_US",
    images: [
      {
        url: `${SITE_URL}/og-default.jpg`,
        width: 1200,
        height: 630,
        alt: "SFXFolder — Free Sound Effects & Video Assets",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Sound Effects & Video Assets — SFXFolder",
    description:
      "Download free sound effects, music, LUTs & more. Curated video editing assets — instant download, no copyright.",
    images: [`${SITE_URL}/og-default.jpg`],
  },
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add your Google Search Console verification code here
    google: 'MWXJYU1hhGxSbzmdw4X1ylzd8KbLU4I8jL1HJQR-N20',
  },
};

// Helper to parse meta and link tags from raw HTML string
function parseMetaAndLinkTags(htmlString) {
  if (!htmlString) return [];
  const tags = [];
  // Remove HTML comments
  const cleanHtml = htmlString.replace(/<!--[\s\S]*?-->/g, '');
  
  // Match meta and link tags
  const regex = /<(meta|link)\b([^>]*)\/?>/gi;
  let match;
  while ((match = regex.exec(cleanHtml)) !== null) {
    const tagName = match[1].toLowerCase();
    const attrsStr = match[2];
    
    // Parse attributes
    const attrs = {};
    const attrRegex = /(\w+)(?:=(?:["']([^"']*)["']|(\S+)))?/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrsStr)) !== null) {
      const name = attrMatch[1];
      let reactName = name;
      if (name === 'crossorigin') reactName = 'crossOrigin';
      else if (name === 'charset') reactName = 'charSet';
      else if (name === 'http-equiv') reactName = 'httpEquiv';
      else if (name === 'class') reactName = 'className';
      
      const value = attrMatch[2] !== undefined ? attrMatch[2] : (attrMatch[3] !== undefined ? attrMatch[3] : true);
      attrs[reactName] = value;
    }
    
    tags.push({ type: tagName, attrs });
  }
  return tags;
}

export default async function RootLayout({ children }) {
  // Fetch categories and settings on the server (cached)
  const [categories, settings] = await Promise.all([
    getCategories(),
    getSiteSettings()
  ]);

  const headScript = settings?.ads_config?.head_script || '';
  const parsedMetaAndLinkTags = parseMetaAndLinkTags(headScript);

  // JSON-LD: WebSite schema with SearchAction for sitelinks search box
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "SFXFolder",
    url: SITE_URL,
    description: "Free sound effects, music, and video editing assets",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  // JSON-LD: Organization schema with dynamic social links
  const socialUrls = (settings?.social_links || []).map(s => s.url).filter(Boolean);
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SFXFolder",
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.webp?v=3`,
    sameAs: socialUrls,
  };

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico?v=3" sizes="any" />
        <link rel="icon" href="/favicon.webp?v=3" type="image/webp" />
        <link rel="apple-touch-icon" href="/favicon.webp?v=3" />
        <link rel="manifest" href="/site.webmanifest" />
        {/* Render dynamic verification/meta/link tags from site settings */}
        {parsedMetaAndLinkTags.map((tag, idx) => {
          if (tag.type === 'meta') {
            return <meta key={`dyn-meta-${idx}`} {...tag.attrs} />;
          }
          if (tag.type === 'link') {
            return <link key={`dyn-link-${idx}`} {...tag.attrs} />;
          }
          return null;
        })}
      </head>
      <body suppressHydrationWarning>
        <GoogleAnalytics gaId="G-LW9D5CH1WQ" />

        {/* Ezoic & Gatekeeper Consent Scripts */}
        <Script
          id="ezoic-cmp"
          src="https://cmp.gatekeeperconsent.com/min.js"
          strategy="beforeInteractive"
          data-cfasync="false"
        />
        <Script
          id="ezoic-cmp-2"
          src="https://the.gatekeeperconsent.com/cmp.min.js"
          strategy="beforeInteractive"
          data-cfasync="false"
        />
        <Script
          id="ezoic-sa"
          src="//www.ezojs.com/ezoic/sa.min.js"
          strategy="afterInteractive"
        />
        <Script id="ezoic-init" strategy="afterInteractive">
          {`
            window.ezstandalone = window.ezstandalone || {};
            window.ezstandalone.cmd = window.ezstandalone.cmd || [];
          `}
        </Script>
        <Script
          id="ezoic-analytics"
          src="//ezoicanalytics.com/analytics.js"
          strategy="afterInteractive"
        />
        <script
          id="schema-website"
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteSchema),
          }}
        />
        <script
          id="schema-organization"
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ToastProvider>
            <AuthProvider>
              <FavoritesProvider>
                <SiteProvider initialSettings={settings} initialCategories={categories}>
                  <EzoicRouteHandler />
                  <ClientGlobalAds />
                  <SmoothScroll>
                    <LayoutShell initialCategories={categories}>{children}</LayoutShell>
                  </SmoothScroll>
                  <ToastContainer />
                  <SpeedInsights />
                  <Analytics />
                </SiteProvider>
              </FavoritesProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
