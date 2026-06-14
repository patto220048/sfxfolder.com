"use client";

import React, { memo } from "react";
import Link from "next/link";

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

  // Logic to split company links if more than 4
  const companyLinks = [
    { label: "About Us", href: "/about-us" },
    { label: "Contact", href: "/contact" },
    { label: "Pricing", href: "/pricing" },
    { label: "Q&A", href: "/faq" },
    { label: "Terms of Service", href: "/terms", target: "_blank", rel: "noopener noreferrer" },
    { label: "Privacy Policy", href: "/privacy", target: "_blank", rel: "noopener noreferrer" },
    { label: "Shop", href: "/shop" },
    { label: "Blog", href: "/v1/blog" },
  ];
  const initialCompany = companyLinks.slice(0, 4);
  const moreCompany = companyLinks.length > 4 ? companyLinks.slice(4) : [];

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
                {initialCompany.map((link, idx) => (
                  <li key={idx}>
                    <Link href={link.href} className={styles.footerLink} target={link.target} rel={link.rel}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {moreCompany.length > 0 && (
              <div className={styles.linkCol}>
                <h4 className={styles.colTitle}>Legal</h4>
                <ul className={styles.linkList}>
                  {moreCompany.map((link, idx) => (
                    <li key={idx}>
                      <Link href={link.href} className={styles.footerLink} target={link.target} rel={link.rel}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
            <span>Version {settings.project_version}</span>
            <span className={styles.statusText}>{settings.status_text}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default memo(Footer);
