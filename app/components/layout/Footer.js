import Link from "next/link";
import { ExternalLink, Mail } from "lucide-react";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer} id="main-footer">
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.logo}>EditerLor</span>
          <p className={styles.tagline}>Free Resources for Video Editors</p>
        </div>

        <div className={styles.linksGroup}>
          <h4 className={styles.groupTitle}>Categories</h4>
          <ul className={styles.linksList}>
            <li><Link href="/sound-effects">Sound Effects</Link></li>
            <li><Link href="/music">Music</Link></li>
            <li><Link href="/video-meme">Video Meme</Link></li>
            <li><Link href="/green-screen">Green Screen</Link></li>
          </ul>
        </div>

        <div className={styles.linksGroup}>
          <h4 className={styles.groupTitle}>More</h4>
          <ul className={styles.linksList}>
            <li><Link href="/animation">Animation</Link></li>
            <li><Link href="/image-overlay">Image & Overlay</Link></li>
            <li><Link href="/font">Font</Link></li>
            <li><Link href="/preset-lut">Preset & LUT</Link></li>
          </ul>
        </div>

        <div className={styles.linksGroup}>
          <h4 className={styles.groupTitle}>Connect</h4>
          <div className={styles.socialLinks}>
            <a href="mailto:contact@editerlor.com" aria-label="Email" className={styles.socialLink}>
              <Mail size={18} />
            </a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className={styles.socialLink}>
              <ExternalLink size={18} />
            </a>
          </div>
        </div>
      </div>

      <div className={styles.bottom}>
        <p>&copy; {new Date().getFullYear()} EditerLor. All rights reserved.</p>
        <p className={styles.tip}>
          <span className={styles.tipIcon}>💡</span>
          Tip: Right-click anywhere to quick search!
        </p>
      </div>
    </footer>
  );
}
