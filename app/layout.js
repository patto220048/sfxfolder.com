import { ThemeProvider } from "@/app/components/providers/ThemeProvider";
import "./globals.css";
import "./animations.css";
import LayoutShell from "@/app/components/layout/LayoutShell";
import { getCategories } from "@/app/lib/api";
import { ToastProvider } from "@/app/context/ToastContext";
import { ToastContainer } from "@/app/components/ui/ToastContainer";

export const metadata = {
  title: "EditerLor — Free Resources for Video Editors",
  description:
    "Download free sound effects, music, video memes, green screens, animations, overlays, fonts, and presets for your video editing projects.",
  openGraph: {
    title: "EditerLor — Free Resources for Video Editors",
    description:
      "Download free sound effects, music, video memes, green screens, animations, overlays, fonts, and presets.",
    type: "website",
  },
};

export default async function RootLayout({ children }) {
  // Fetch categories on the server (cached)
  const categories = await getCategories();

  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ToastProvider>
            <LayoutShell initialCategories={categories}>{children}</LayoutShell>
            <ToastContainer />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
