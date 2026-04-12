import { ThemeProvider } from "@/app/components/providers/ThemeProvider";
import "./globals.css";
import "./animations.css";
import LayoutShell from "@/app/components/layout/LayoutShell";

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

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <LayoutShell>{children}</LayoutShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
