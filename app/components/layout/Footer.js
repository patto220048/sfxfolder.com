"use client";

import React, { memo } from "react";
import Link from "next/link";
import { Activity } from "lucide-react";
import { useSiteData } from "@/app/context/SiteContext";
import styles from "./Footer.module.css";

function Footer() {
  const { settings, categories } = useSiteData();

  if (!settings) return null;

  const getBrandColor = (name) => {
    const n = name.toLowerCase();
    if (n.includes('facebook')) return '#1877F2';
    if (n.includes('youtube')) return '#FF0000';
    if (n.includes('twitter') || n.includes(' x ')) return '#1da1f2';
    if (n.includes('instagram')) return '#E4405F';
    if (n.includes('discord')) return '#5865F2';
    if (n.includes('github')) return '#333333';
    return 'var(--neon-cyan)'; // Default fallback
  };

  // Logic to split resources if more than 4
  const footerCategories = categories || [];
  const initialResources = footerCategories.slice(0, 4);
  const moreResources = footerCategories.length > 4 ? footerCategories.slice(4) : [];

  return (
    <footer className={styles.footer} id="main-footer">
      <div className={styles.mainContent}>
        <div className={styles.inner}>
          {/* Brand Section with Social Icons */}
          <div className={styles.brandCol}>
            <Link href="/" className={styles.logo}>{settings.site_name}</Link>
            <p className={styles.brandDesc}>{settings.tagline}</p>
            
            {/* Social Icons under Brand */}
            {settings.social_links && settings.social_links.length > 0 && (
              <div className={styles.socialIconsInline}>
                {settings.social_links.map((social, idx) => (
                  <a 
                    key={idx}
                    href={social.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={styles.socialIconWrapper} 
                    title={social.name}
                  >
                    <span className={styles.socialIconContainer}>
                      {social.icon_url ? (
                        <img src={social.icon_url} alt={social.name} className={styles.svgIcon} />
                      ) : (
                        <span className={styles.fallbackIcon}>{social.name.charAt(0)}</span>
                      )}
                    </span>
                    <span 
                      className={styles.socialBg} 
                      style={{ backgroundColor: getBrandColor(social.name) }}
                    ></span>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className={styles.linksGrid}>
            <div className={styles.linkCol}>
              <h4 className={styles.colTitle}>Resources</h4>
              <ul className={styles.linkList}>
                {initialResources.map((cat) => (
                  <li key={cat.slug}>
                    <Link href={`/${cat.slug}`} className={styles.footerLink}>{cat.name}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {moreResources.length > 0 && (
              <div className={styles.linkCol}>
                <h4 className={styles.colTitle}>More</h4>
                <ul className={styles.linkList}>
                  {moreResources.map((cat) => (
                    <li key={cat.slug}>
                      <Link href={`/${cat.slug}`} className={styles.footerLink}>{cat.name}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className={styles.linkCol}>
              <h4 className={styles.colTitle}>Company</h4>
              <ul className={styles.linkList}>
                <li><Link href="/about-us" className={styles.footerLink}>About Us</Link></li>
                <li><Link href="/contact" className={styles.footerLink}>Contact</Link></li>
                <li><Link href="/pricing" className={styles.footerLink}>Pricing</Link></li>
                <li><Link href="/faq" className={styles.footerLink}>Q&A</Link></li>
                <li>
                  <Link href="/terms" className={styles.footerLink} target="_blank" rel="noopener noreferrer">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className={styles.footerLink} target="_blank" rel="noopener noreferrer">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.bottomBar}>
        <div className={styles.innerBottom}>
          <div className={styles.copyright}>
            &copy; {new Date().getFullYear()} {settings.site_name}. Stark Monochrome Edition.
          </div>
          <div className={styles.versionInfo}>
            <div className={styles.statusIndicator}>
              <span className={styles.pulseDot}></span>
            </div>
            <Activity size={14} className={styles.versionIcon} />
            <span>Version {settings.project_version}</span>
            <span className={styles.statusText}>{settings.status_text}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default memo(Footer);
