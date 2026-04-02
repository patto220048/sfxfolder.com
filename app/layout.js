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
    <html lang="en">
      <body>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
