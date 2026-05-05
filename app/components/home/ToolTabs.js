"use client";

import { useState } from "react";
import styles from "./ToolTabs.module.css";

export default function ToolTabs() {
  const [activeTab, setActiveTab] = useState("premiere");

  const tabs = [
    { id: "premiere", label: "Premiere Pro", status: "Active" },
    { id: "davinci", label: "DaVinci Resolve", status: "Coming Soon" },
    { id: "aftereffects", label: "After Effects", status: "Coming Soon" },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.tabHeader}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tabBtn} ${activeTab === tab.id ? styles.active : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.status === "Coming Soon" && <span className={styles.statusBadge}>SOON</span>}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {activeTab === "premiere" && (
          <div className={styles.activeContent}>
            <div className={styles.pluginTag}>STABLE VERSION</div>
            <h2 className={styles.pluginTitle}>SFXFolder for Premiere Pro</h2>
            <p className={styles.pluginSubtitle}>
              The ultimate extension for video editors. Search and drag & drop assets directly into your timeline without leaving Premiere.
            </p>
            <div className={styles.pluginButtons}>
              <a href="/downloads/SFXFolder_Setup.zip" download className={`${styles.downloadBtn} ${styles.winBtn}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M0 3.449L9.75 2.1V11.7H0V3.449zm0 9.151h9.75v9.6L0 20.551V12.6zm10.65-10.5L24 0v11.7h-13.35V2.1zM10.65 12.6H24v11.4l-13.35-2.1V12.6z"/></svg>
                Windows (.zip)
              </a>
              <a href="/downloads/install_mac.command" download className={`${styles.downloadBtn} ${styles.macBtn}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.057 12.781c.032 2.588 2.254 3.462 2.287 3.477-.023.072-.355 1.213-1.155 2.384-.693 1.012-1.413 2.022-2.532 2.042-1.101.02-1.453-.648-2.711-.648-1.258 0-1.65.628-2.711.668-1.101.04-1.921-1.112-2.618-2.122-1.428-2.062-2.518-5.822-1.048-8.362.728-1.263 2.023-2.064 3.428-2.084 1.066-.02 2.072.719 2.723.719.651 0 1.872-.91 3.142-.784 1.27.126 2.224.64 2.824 1.514-.023.014-2.627 1.534-2.6 4.6zM15.303 3.693c.571-.693.955-1.655.849-2.618-.826.033-1.826.549-2.418 1.242-.531.614-.997 1.597-.872 2.539.923.072 1.869-.47 2.441-1.163z"/></svg>
                macOS (.command)
              </a>
            </div>
          </div>
        )}

        {(activeTab === "davinci" || activeTab === "aftereffects") && (
          <div className={styles.comingSoonContent}>
            <div className={styles.comingSoonIcon}>
              {activeTab === "davinci" ? "🎨" : "⚡"}
            </div>
            <h2 className={styles.pluginTitle}>
              SFXFolder for {activeTab === "davinci" ? "DaVinci Resolve" : "After Effects"}
            </h2>
            <p className={styles.pluginSubtitle}>
              We are working hard to bring the same seamless experience to your favorite software. 
              Stay tuned for the official release!
            </p>
            <div className={styles.comingSoonBadge}>COMING SOON</div>
          </div>
        )}
      </div>
    </div>
  );
}
