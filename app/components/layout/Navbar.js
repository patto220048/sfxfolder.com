"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Menu, X } from "lucide-react";
import ThemeToggle from "@/app/components/ui/ThemeToggle";
import styles from "./Navbar.module.css";

const categories = [
  { name: "Sound Effects", slug: "sound-effects" },
  { name: "Music", slug: "music" },
  { name: "Video Meme", slug: "video-meme" },
  { name: "Green Screen", slug: "green-screen" },
  { name: "Animation", slug: "animation" },
  { name: "Image & Overlay", slug: "image-overlay" },
  { name: "Font", slug: "font" },
  { name: "Preset & LUT", slug: "preset-lut" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`${styles.navbar} ${scrolled ? styles.scrolled : ""}`}
      id="main-navbar"
    >
      <div className={styles.inner}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <span className={styles.logoText}>
            EditerLor
          </span>
        </Link>

        {/* Desktop nav */}
        <ul className={styles.links}>
          {categories.slice(0, 5).map((cat) => (
            <li key={cat.slug}>
              <Link href={`/${cat.slug}`} className={styles.link}>
                {cat.name}
              </Link>
            </li>
          ))}
          <li className={styles.moreDropdown}>
            <span className={styles.link}>More ▾</span>
            <ul className={styles.dropdown}>
              {categories.slice(5).map((cat) => (
                <li key={cat.slug}>
                  <Link href={`/${cat.slug}`} className={styles.dropdownLink}>
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        </ul>

        {/* Actions */}
        <div className={styles.actions}>
          <ThemeToggle />
          
          <Link href="/search" className={styles.searchBtn} aria-label="Search">
            <Search size={20} />
          </Link>

          <button
            className={styles.hamburger}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className={styles.mobileMenu}>
          <ul className={styles.mobileLinks}>
            {categories.map((cat) => (
              <li key={cat.slug}>
                <Link
                  href={`/${cat.slug}`}
                  className={styles.mobileLink}
                  onClick={() => setMobileOpen(false)}
                >
                  {cat.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
