"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Menu, X } from "lucide-react";
import ThemeToggle from "@/app/components/ui/ThemeToggle";
import GlobalAudioSettings from "@/app/components/ui/GlobalAudioSettings";
import { getCategories } from "@/app/lib/api";
import styles from "./Navbar.module.css";

export default function Navbar({ initialCategories = [] }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [categories, setCategories] = useState(initialCategories);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);

    // Sync state if initialCategories change significantly
    if (initialCategories.length > 0 && categories.length === 0) {
      setCategories(initialCategories);
    }

    return () => window.removeEventListener("scroll", handleScroll);
  }, [initialCategories, categories.length]);

  // Reset navigating state when pathname changes
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  const handleLinkClick = (e, href) => {
    // 1. Prevent if currently on the same page
    if (pathname === href) {
      e.preventDefault();
      // Optionally scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 2. Prevent rapid multiple clicks to different pages
    if (isNavigating) {
      e.preventDefault();
      return;
    }

    setIsNavigating(true);
    // Timeout as a safety measure if navigation fails/takes too long
    setTimeout(() => setIsNavigating(false), 2000);
  };

  return (
    <nav
      className={`${styles.navbar} ${scrolled ? styles.scrolled : ""}`}
      id="main-navbar"
    >
      <div className={styles.inner}>
        {/* Logo */}
        <Link 
          href="/" 
          className={styles.logo}
          onClick={(e) => handleLinkClick(e, "/")}
        >
          <span className={styles.logoText}>
            EditerLor
          </span>
        </Link>

        {/* Desktop nav */}
        <ul className={styles.links}>
          {categories.slice(0, 5).map((cat) => (
            <li key={cat.slug}>
              <Link 
                href={`/${cat.slug}`} 
                className={styles.link}
                onClick={(e) => handleLinkClick(e, `/${cat.slug}`)}
              >
                {cat.name}
              </Link>
            </li>
          ))}
          <li className={styles.moreDropdown}>
            <span className={styles.link}>More ▾</span>
            <ul className={styles.dropdown}>
              {categories.slice(5).map((cat) => (
                <li key={cat.slug}>
                  <Link 
                    href={`/${cat.slug}`} 
                    className={styles.dropdownLink}
                    onClick={(e) => handleLinkClick(e, `/${cat.slug}`)}
                  >
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
          <GlobalAudioSettings />
          
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
                  onClick={(e) => {
                    handleLinkClick(e, `/${cat.slug}`);
                    setMobileOpen(false);
                  }}
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
