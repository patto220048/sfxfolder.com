"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Menu, X, UserCircle } from "lucide-react";
import ThemeToggle from "@/app/components/ui/ThemeToggle";
import GlobalAudioSettings from "@/app/components/ui/GlobalAudioSettings";
import AuthModal from "@/app/components/auth/AuthModal";
import UserMenu from "@/app/components/auth/UserMenu";
import PremiumModal from "@/app/components/ui/PremiumModal";
import { useAuth } from "@/app/lib/auth-context";
import { useSiteData } from "@/app/context/SiteContext";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { settings, categories } = useSiteData();
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [authModalConfig, setAuthModalConfig] = useState(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    const handleNeedAuth = (e) => {
      if (e.detail) {
        setAuthModalConfig(e.detail);
      } else {
        setAuthModalConfig(null);
      }
      setAuthModalOpen(true);
    };
    const handleNeedPremium = () => setPremiumModalOpen(true);
    
    window.addEventListener("scroll", handleScroll);
    window.addEventListener("need-auth", handleNeedAuth);
    window.addEventListener("need-premium", handleNeedPremium);
    
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("need-auth", handleNeedAuth);
      window.removeEventListener("need-premium", handleNeedPremium);
    };
  }, []);

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
    <>
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
              {settings?.site_name || "EditerLor"}
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

            {/* Auth: Sign In button or User Menu */}
            <div className={styles.authAction}>
              {authLoading ? (
                <div className={styles.authPlaceholder} />
              ) : user ? (
                <UserMenu />
              ) : (
                <button
                  className={styles.signInBtn}
                  onClick={() => setAuthModalOpen(true)}
                  aria-label="Sign in"
                >
                  <UserCircle size={22} />
                  <span className={styles.signInText}>Sign In</span>
                </button>
              )}
            </div>

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
            {/* Mobile sign in */}
            {!authLoading && !user && (
              <button
                className={styles.mobileSignIn}
                onClick={() => {
                  setMobileOpen(false);
                  setAuthModalOpen(true);
                }}
              >
                <UserCircle size={20} />
                <span>Sign In</span>
              </button>
            )}
          </div>
        )}
      </nav>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        config={authModalConfig}
      />

      {/* Premium Modal */}
      <PremiumModal
        isOpen={premiumModalOpen}
        onClose={() => setPremiumModalOpen(false)}
      />
    </>
  );
}
