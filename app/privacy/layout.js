export const metadata = {
  title: "Privacy Policy",
  description: "SFXFolder.com Privacy Policy — Learn how we collect, use, and protect your personal information when using our free sound effects and video editing resources.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://sfxfolder.com'}/privacy`,
  },
};

export default function PrivacyLayout({ children }) {
  return children;
}
