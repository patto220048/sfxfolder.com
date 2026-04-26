export const metadata = {
  title: "Terms of Service",
  description: "SFXFolder.com Terms of Service — Understand your rights and responsibilities when using our free sound effects, music, and video editing resources.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://sfxfolder.com'}/terms`,
  },
};

export default function TermsLayout({ children }) {
  return children;
}
