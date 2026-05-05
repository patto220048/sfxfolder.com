"use client";

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

// Lazy-load Lenis (~30KB) — not needed for LCP
const LenisScroll = dynamic(
  () => import('./LenisScroll'),
  { ssr: false }
);

// Only enable Lenis on pages that benefit from smooth scroll
// Category pages (/sound-effects, /bgm, etc.) use position: sticky sidebar — Lenis breaks it
const SMOOTH_SCROLL_ROUTES = ['/', '/about-us', '/pricing', '/contact', '/terms', '/privacy', '/faq'];

export default function SmoothScroll({ children }) {
  const pathname = usePathname();
  
  const enableSmooth = SMOOTH_SCROLL_ROUTES.includes(pathname);

  if (!enableSmooth) {
    return <>{children}</>;
  }

  return (
    <LenisScroll>
      {children}
    </LenisScroll>
  );
}
