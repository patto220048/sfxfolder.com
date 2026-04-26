import { ThemeProvider } from "@/app/components/providers/ThemeProvider";
import "./globals.css";
import "./animations.css";
import LayoutShell from "@/app/components/layout/LayoutShell";
import { getCategories, getSiteSettings } from "@/app/lib/api";
import { ToastProvider } from "@/app/context/ToastContext";
import { ToastContainer } from "@/app/components/ui/ToastContainer";
import { SiteProvider } from "@/app/context/SiteContext";
import { AuthProvider } from "@/app/lib/auth-context";

import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sfxfolder.com';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SFXFolder — Free Sound Effects, Music & Assets for Video Editors",
    template: "%s | SFXFolder",
  },
  description:
    "Download free sound effects, royalty-free music, video memes, green screens, animations, overlays, fonts, and presets. High-quality SFX and assets for YouTube, TikTok, and professional video editing.",
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
  openGraph: {
    title: "SFXFolder — Free Sound Effects, Music & Assets for Video Editors",
    description:
      "Download free sound effects, royalty-free music, video memes, green screens, animations, overlays, fonts, and presets for your video editing projects.",
    type: "website",
    url: SITE_URL,
    siteName: "SFXFolder",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "SFXFolder — Free SFX, Music & Assets",
    description:
      "High-quality free sound effects, music, and video editing assets. Download instantly, no copyright issues.",
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
    // google: 'your-verification-code',
  },
};

export default async function RootLayout({ children }) {
  // Fetch categories and settings on the server (cached)
  const [categories, settings] = await Promise.all([
    getCategories(),
    getSiteSettings()
  ]);

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

  // JSON-LD: Organization schema
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SFXFolder",
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.ico`,
    sameAs: [],
  };

  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ToastProvider>
            <AuthProvider>
              <SiteProvider initialSettings={settings} initialCategories={categories}>
                <LayoutShell initialCategories={categories}>{children}</LayoutShell>
                <ToastContainer />
                <SpeedInsights />
                <Analytics />
              </SiteProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
