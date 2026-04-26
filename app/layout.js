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
import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  title: "SFXFolder.com — Free Resources for Video Editors",
  description:
    "Download free sound effects, music, video memes, green screens, animations, overlays, fonts, and presets for your video editing projects.",
  openGraph: {
    title: "SFXFolder.com — Free Resources for Video Editors",
    description:
      "Download free sound effects, music, video memes, green screens, animations, overlays, fonts, and presets.",
    type: "website",
  },
};

export default async function RootLayout({ children }) {
  // Fetch categories and settings on the server (cached)
  const [categories, settings] = await Promise.all([
    getCategories(),
    getSiteSettings()
  ]);

  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
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
