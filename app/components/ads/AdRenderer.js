"use client";

import AdSlot from "./AdSlot";
import EzoicAd from "./EzoicAd";

/**
 * AdRenderer Component
 * Dynamically decides whether to render an Ezoic placeholder (if content is a number)
 * or a raw HTML slot (if content is HTML/JS code like Google AdSense).
 * If no content is set, it renders the provided placeholder fallback.
 */
export default function AdRenderer({ content, placeholder }) {
  const trimmed = content?.trim() || "";

  // Check if content is empty
  if (trimmed === "") {
    return placeholder || null;
  }

  // Check if content is a numeric value (Ezoic placeholder ID)
  const isNumeric = /^\d+$/.test(trimmed);

  if (isNumeric) {
    const ezoicId = parseInt(trimmed, 10);
    return <EzoicAd id={ezoicId} />;
  }

  // Otherwise, fallback to raw HTML AdSlot
  return <AdSlot htmlContent={trimmed} />;
}
