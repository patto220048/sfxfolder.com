import AboutUsClient from "./AboutUsClient";
import { getSiteSettings } from "@/app/lib/api";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sfxfolder.com';

export const metadata = {
  title: "About Us — The Mission Behind SFXFolder",
  description: "Learn about SFXFolder, a curated collection of pro-grade sound effects and assets for video editors, created from real-world professional experience.",
  openGraph: {
    title: "About Us — SFXFolder",
    description: "Hand-picked free sound effects and assets for video editors based on professional experience.",
    url: `${SITE_URL}/about-us`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "About Us — SFXFolder",
    description: "Curated free pro-grade sound effects and tools for editors.",
  },
};

export default async function AboutUsPage() {
  const settings = await getSiteSettings();
  
  const aboutPageSchema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "mainEntity": {
      "@type": "Organization",
      "name": settings?.site_name || "SFXFolder",
      "url": SITE_URL,
      "description": settings?.tagline || "Free high-quality resources for video editors."
    }
  };

  return (
    <AboutUsClient 
      aboutPageSchema={aboutPageSchema} 
      socialLinks={settings?.social_links || []}
      contactEmail={settings?.contact_email}
      siteName={settings?.site_name}
    />
  );
}
