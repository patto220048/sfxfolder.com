"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Activity } from "lucide-react";
import { getSiteSettings, getCategories } from "@/app/lib/api";
import styles from "./Footer.module.css";

export default function Footer() {
  const [settings, setSettings] = useState({
    site_name: "EditerLor",
    tagline: "Free Resources for Video Editors",
    project_version: "v 0.1.16.4",
    status_text: "System Online",
    social_links: []
  });
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const [settingsData, categoriesData] = await Promise.all([
          getSiteSettings(),
          getCategories()
        ]);
        
        if (settingsData) {
          setSettings({
            ...settingsData,
            social_links: settingsData.social_links || []
          });
        }
        if (categoriesData) setCategories(categoriesData);
      } catch (err) {
        console.error("Failed to load footer data:", err);
      }
    }
    load();
  }, []);

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
                    className={styles.socialIcon} 
                    title={social.name}
                  >
                    {social.icon_url ? (
                      <img src={social.icon_url} alt={social.name} className={styles.svgIcon} />
                    ) : (
                      <span className={styles.fallbackIcon}>{social.name.charAt(0)}</span>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className={styles.linksGrid}>
            <div className={styles.col}>
              <h4 className={styles.colTitle}>Resources</h4>
              <ul className={styles.links}>
                {categories.length > 0 ? (
                  categories.slice(0, 4).map((cat) => (
                    <li key={cat.id}>
                      <Link href={`/${cat.slug}`}>{cat.name}</Link>
                    </li>
                  ))
                ) : (
                  <>
                    <li><Link href="/sound-effects">Sound Effects</Link></li>
                    <li><Link href="/video-overlay">Video & Overlay</Link></li>
                  </>
                )}
              </ul>
            </div>

            {categories.length > 4 && (
              <div className={styles.col}>
                <h4 className={styles.colTitle}>More</h4>
                <ul className={styles.links}>
                  {categories.slice(4).map((cat) => (
                    <li key={cat.id}>
                      <Link href={`/${cat.slug}`}>{cat.name}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className={styles.col}>
              <h4 className={styles.colTitle}>Support</h4>
              <ul className={styles.links}>
                <li><Link href="/contact">Contact Us</Link></li>
                <li><Link href="/faq">FAQ</Link></li>
                <li><Link href="/submit">Submit Resource</Link></li>
              </ul>
            </div>

            <div className={styles.col}>
              <h4 className={styles.colTitle}>Legal</h4>
              <ul className={styles.links}>
                <li>
                  <Link href="/terms" className={styles.legalLink} target="_blank" rel="noopener noreferrer">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className={styles.legalLink} target="_blank" rel="noopener noreferrer">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Layer 3: Bottom Credits */}
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
          </div>
        </div>
      </div>
    </footer>
  );
}
