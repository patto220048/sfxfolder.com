"use client";

import { useState, useEffect } from 'react';
import { useSiteData } from "@/app/context/SiteContext";
import { useAuth } from "@/app/lib/auth-context";
import AdRenderer from "./AdRenderer";
import styles from "@/app/page.module.css";

export default function ClientHomeAds({ side }) {
  const { settings } = useSiteData();
  const { isPremium } = useAuth();
  const adsConfig = settings?.ads_config || {};
  const [showCloseButton, setShowCloseButton] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowCloseButton(true);
    }, 5000);
    
    const handleSyncClose = () => setIsVisible(false);
    window.addEventListener('close-home-ads', handleSyncClose);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('close-home-ads', handleSyncClose);
    };
  }, []);
  
  const handleClose = () => {
    setIsVisible(false);
    window.dispatchEvent(new CustomEvent('close-home-ads'));
  };
  
  const adContent = side === 'left' ? adsConfig.home_left : adsConfig.home_right;
  const label = side === 'left' ? 'Trang Chủ - Trái (160x600)' : 'Trang Chủ - Phải (160x600)';

  if (!isVisible || isPremium) return null;

  return (
    <div className={adContent ? styles.sideAdContainer : styles.sideAdPlaceholder}>
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {showCloseButton && (
          <button 
            onClick={handleClose}
            style={{
              position: 'absolute',
              top: '-25px',
              right: '0',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '12px',
              cursor: 'pointer',
              zIndex: 10
            }}
          >
            Close Ads
          </button>
        )}
        <AdRenderer content={adContent} placeholder={label} />
      </div>
    </div>
  );
}
