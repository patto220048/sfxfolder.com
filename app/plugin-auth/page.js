"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/lib/auth-context";
import styles from "./page.module.css";
import AuthModal from "@/app/components/auth/AuthModal";

export default function PluginAuthPage() {
  const { user, session } = useAuth();
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    if (session?.access_token && session?.refresh_token) {
      try {
        const syncData = {
          access_token: session.access_token,
          refresh_token: session.refresh_token
        };
        setToken(btoa(JSON.stringify(syncData))); // Base64 encode for easier copying
      } catch (e) {
        console.error("Token generation error:", e);
      } finally {
        setIsGenerating(false);
      }
    } else if (user) {
      // If user is present but session is not yet available, we might be loading
      setIsGenerating(true);
    } else {
      setIsGenerating(false);
    }
  }, [session, user]);

  const copyToClipboard = () => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1>RE-SRC SYNC</h1>
          <p>Please login to your account to sync with Premiere Pro.</p>
          <button 
            onClick={() => setIsAuthModalOpen(true)} 
            className={styles.loginBtn}
          >
            LOGIN TO WEBSITE
          </button>
        </div>
        
        <AuthModal 
          isOpen={isAuthModalOpen} 
          onClose={() => setIsAuthModalOpen(false)} 
        />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.badge}>SYNC ACTIVE</div>
        <h1>CONNECTION READY</h1>
        <p>Copy the code below and paste it into the Premiere Pro plugin to complete the connection.</p>
        
        <div className={styles.tokenWrapper}>
          <input 
            type="text" 
            value={isGenerating ? "Generating code..." : token || "Session error. Please login again."} 
            readOnly 
            className={styles.tokenInput}
            onClick={(e) => e.target.select()}
          />
          <button 
            onClick={copyToClipboard}
            className={styles.copyBtn}
            disabled={!token || isGenerating}
          >
            {copied ? "COPIED!" : "COPY CODE"}
          </button>
        </div>

        <div className={styles.instructions}>
          <h3>How to sync:</h3>
          <ol>
            <li>Click &quot;COPY CODE&quot; above</li>
            <li>Go back to Premiere Pro</li>
            <li>Paste the code into the login field</li>
            <li>Click &quot;CONNECT&quot;</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
